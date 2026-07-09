import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireApiModuleAccess } from "@/lib/module-access";
import { parseNormalInvoiceMeta } from "@/lib/normal-invoice-meta";
import {
  cancelInvoiceRecord,
  deleteInvoiceRecord,
} from "@/lib/invoice-cancel-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const patchSchema = z.object({
  action: z.enum(["cancel"]),
  reason: z.string().trim().min(1, "İptal nedeni zorunludur.").optional(),
});

export async function GET(_req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const invoice = await db.invoice.findFirst({
      where: {
        id,
        companyId: auth.companyId,
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

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz işlem." },
        { status: 400 }
      );
    }

    const result = await cancelInvoiceRecord({
      companyId: auth.companyId,
      userId: auth.userId,
      invoiceId: id,
      reason: parsed.data.reason,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "invoice-cancel",
        entity: { id },
        message: result.message ?? "Fatura iptal edildi.",
        entityIds: { invoiceId: id },
      })
    );
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

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const result = await deleteInvoiceRecord({
      companyId: auth.companyId,
      userId: auth.userId,
      invoiceId: id,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "invoice-delete",
        entity: { id },
        message: "Fatura silindi.",
        entityIds: { invoiceId: id },
      })
    );
  } catch (error) {
    console.error("INVOICE_DELETE_API_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Fatura silinirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
