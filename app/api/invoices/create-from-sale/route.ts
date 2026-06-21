import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import {
  generateInvoiceNo,
  getMockGibMeta,
  resolveInvoiceStatusForType,
} from "@/lib/invoices/mock-gib";
import { persistInvoiceFinancialSnapshot } from "@/lib/invoice-snapshot-service";
import {
  buildInvoiceSnapshotData,
  saleItemToInvoiceLineInput,
} from "@/lib/invoice-snapshot-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";

const createFromSaleSchema = z.object({
  saleId: z.string().min(1, "Satış seçilmelidir."),
  type: z.enum(["NORMAL", "E_INVOICE", "E_ARCHIVE"]).default("NORMAL"),
  status: z
    .enum(["DRAFT", "SENT", "APPROVED", "CANCELLED", "ERROR"])
    .optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const body = await req.json();
    const parsed = createFromSaleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { saleId, type } = parsed.data;
    const status = resolveInvoiceStatusForType(type, parsed.data.status);

    const sale = await db.sale.findFirst({
      where: {
        id: saleId,
        companyId: companyId,
      },
      include: {
        invoice: true,
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, message: "Satış bulunamadı." },
        { status: 404 }
      );
    }

    if (sale.invoice) {
      return NextResponse.json(
        {
          success: false,
          message: "Bu satış için zaten fatura oluşturulmuş.",
        },
        { status: 400 }
      );
    }

    const lineItems = sale.items.map((item) => saleItemToInvoiceLineInput(item));
    const snapshot = buildInvoiceSnapshotData(lineItems, Number(sale.discount));
    const gib = getMockGibMeta(type, status);

    const invoice = await db.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          companyId: companyId!,
          customerId: sale.customerId,
          saleId: sale.id,
          invoiceNo: generateInvoiceNo(type),
          type,
          status,
          subtotal: snapshot.header.subtotal,
          totalDiscount: snapshot.header.totalDiscount,
          taxableAmount: snapshot.header.taxableAmount,
          totalVat: snapshot.header.totalVat,
          total: snapshot.header.grandTotal,
          financialSnapshotStatus: "COMPLETE",
          paymentStatus: sale.paymentStatus,
          paidAmount: sale.paidAmount,
          gibStatus: gib.gibStatus,
          gibMessage: gib.gibMessage,
        },
        include: {
          customer: true,
          sale: true,
        },
      });

      await persistInvoiceFinancialSnapshot(tx, {
        invoiceId: createdInvoice.id,
        items: lineItems,
        invoiceDiscountAmount: Number(sale.discount),
      });

      return createdInvoice;
    });

    await db.activityLog.create({
      data: {
        companyId: companyId,
        userId: userId,
        action: "CREATE",
        module: "invoices",
        message: `${invoice.invoiceNo} satıştan fatura oluşturuldu.`,
      },
    });

    await createNotification({
      companyId: companyId,
      userId: userId,
      type: status === "ERROR" ? "WARNING" : "SUCCESS",
      category: "INVOICES",
      module: "invoices",
      entityType: "INVOICE",
      entityId: invoice.id,
      actionUrl: `/invoices/${invoice.id}`,
      title: "Satıştan fatura oluşturuldu",
      message: `${invoice.invoiceNo} numaralı fatura kaydı oluşturuldu.`,
    });

    invalidateDashboardCache(companyId, "invoice-create-from-sale");

    return NextResponse.json({
      success: true,
      message: "Fatura satıştan oluşturuldu.",
      data: invoice,
    });
  } catch (error) {
    console.error("CREATE_INVOICE_FROM_SALE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Fatura oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
