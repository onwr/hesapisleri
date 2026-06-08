import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { cancelSaleById } from "@/lib/sale-cancel-service";
import { parseNormalInvoiceMeta } from "@/lib/normal-invoice-meta";
import { reverseCustomerDebtFromDocument, getInvoiceEffectivePaidAmount } from "@/lib/customer-balance-utils";
import { validateInvoiceCancelEligibility } from "@/lib/invoice-service";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

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
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const invoice = await db.invoice.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
      include: {
        customer: true,
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
        gibMessage: displayMessage,
        meta,
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
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

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
        companyId: payload.companyId,
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
        payload.companyId,
        payload.userId
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
          companyId: payload.companyId!,
          userId: payload.userId,
          action: "UPDATE",
          module: "invoices",
          message: `${invoice.invoiceNo} numaralı fatura iptal edildi.`,
        },
      });

      await tx.notification.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          type: "WARNING",
          title: "Fatura iptal edildi",
          message: `${invoice.invoiceNo} numaralı fatura iptal edildi.`,
        },
      });
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
