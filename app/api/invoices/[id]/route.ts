import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { cancelSaleById } from "@/lib/sale-cancel-service";
import { parseNormalInvoiceMeta } from "@/lib/normal-invoice-meta";
import { reverseCustomerDebtFromDocument, getInvoiceEffectivePaidAmount } from "@/lib/customer-balance-utils";
import { validateInvoiceCancelEligibility } from "@/lib/invoice-service";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const patchSchema = z.object({
  action: z.enum(["cancel"]),
});

export async function GET(_req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const invoice = await db.invoice.findFirst({
      where: {
        id,
        companyId: companyId,
      },
      include: {
        customer: true,
        items: {
          orderBy: { lineIndex: "asc" },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: "Fatura bulunamadı." },
        { status: 404 }
      );
    }

    const { displayMessage, meta } = parseNormalInvoiceMeta(invoice.gibMessage);

    return NextResponse.json({
      success: true,
      data: {
        ...invoice,
        total: Number(invoice.total),
        subtotal: Number(invoice.subtotal),
        totalDiscount: Number(invoice.totalDiscount),
        taxableAmount: Number(invoice.taxableAmount),
        totalVat: Number(invoice.totalVat),
        gibMessage: displayMessage,
        meta,
        items: invoice.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.productName,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          vatRate: Number(item.vatRate),
          lineNetAmount: Number(item.lineNetAmount),
          vatAmount: Number(item.vatAmount),
          lineGrossAmount: Number(item.lineGrossAmount),
          discountAmount: Number(item.discountAmount),
        })),
      },
    });
  } catch (error) {
    console.error("INVOICE_GET_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Fatura bilgisi alınırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz işlem." },
        { status: 400 }
      );
    }

    const invoice = await db.invoice.findFirst({
      where: {
        id,
        companyId: companyId,
      },
      include: {
        sale: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: "Fatura bulunamadı." },
        { status: 404 }
      );
    }

    if (invoice.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, message: "Bu fatura zaten iptal edilmiş." },
        { status: 400 }
      );
    }

    if (invoice.status === "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          message: "Onaylanmış e-fatura iptal edilemez.",
        },
        { status: 400 }
      );
    }

    const cancelEligibility = validateInvoiceCancelEligibility(invoice);
    if (!cancelEligibility.ok) {
      return NextResponse.json(
        { success: false, message: cancelEligibility.message },
        { status: 400 }
      );
    }

    if (invoice.saleId) {
      const result = await cancelSaleById(
        invoice.saleId,
        companyId,
        userId
      );

      if (!result.ok) {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: result.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }

    await db.$transaction(async (tx) => {
      const effectivePaid = getInvoiceEffectivePaidAmount(invoice);

      await reverseCustomerDebtFromDocument(
        tx,
        companyId!,
        invoice.customerId,
        Number(invoice.total),
        effectivePaid
      );

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "UNPAID",
          paidAmount: 0,
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: companyId!,
          userId: userId,
          action: "UPDATE",
          module: "invoices",
          message: `${invoice.invoiceNo} numaralı fatura iptal edildi.`,
        },
      });

      await createNotification(
        {
          companyId: companyId!,
          userId: userId,
          type: "WARNING",
          category: "INVOICES",
          module: "invoices",
          entityType: "INVOICE",
          entityId: invoice.id,
          actionUrl: `/invoices/${invoice.id}`,
          title: "Fatura iptal edildi",
          message: `${invoice.invoiceNo} numaralı fatura iptal edildi.`,
        },
        tx
      );
    });

    return NextResponse.json({
      success: true,
      message: "Fatura başarıyla iptal edildi.",
    });
  } catch (error) {
    console.error("INVOICE_CANCEL_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Fatura iptal edilirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
