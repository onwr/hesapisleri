import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { applyCustomerDebtFromDocument } from "@/lib/customer-balance-utils";
import { assertOptionalTenantCustomer } from "@/lib/tenant/tenant-resource";
import { TenantNotFoundError } from "@/lib/tenant/tenant-errors";
import { persistInvoiceFinancialSnapshot } from "@/lib/invoice-snapshot-service";
import { buildInvoiceSnapshotData } from "@/lib/invoice-snapshot-utils";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

const invoiceItemSchema = z.object({
  name: z.string().min(1, "Ürün / hizmet adı zorunludur."),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().default(20),
  productId: z.string().optional(),
});

const createInvoiceSchema = z.object({
  saleId: z.string().optional(),
  customerId: z.string().optional(),
  type: z.enum(["E_INVOICE", "E_ARCHIVE"]).default("E_ARCHIVE"),
  action: z.enum(["DRAFT", "SEND"]).default("SEND"),
  items: z.array(invoiceItemSchema).min(1, "En az bir kalem ekleyin."),
});

function generateInvoiceNo(type: "E_INVOICE" | "E_ARCHIVE") {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `${type === "E_INVOICE" ? "EFT" : "EAR"}-${year}-${random}`;
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const body = await req.json();
    const parsed = createInvoiceSchema.safeParse(body);

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

    const { saleId, customerId, type, action, items } = parsed.data;

    if (saleId) {
      const existingInvoice = await db.invoice.findFirst({
        where: {
          companyId: companyId!,
          saleId,
        },
      });

      if (existingInvoice) {
        return NextResponse.json(
          {
            success: false,
            message: "Bu satış için daha önce fatura oluşturulmuş.",
          },
          { status: 400 }
        );
      }
    }

    const lineItems = items.map((item) => ({
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
    }));

    const snapshot = buildInvoiceSnapshotData(lineItems, 0);

    await assertOptionalTenantCustomer(db, companyId!, customerId);

    const invoice = await db.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          companyId: companyId!,
          customerId: customerId || null,
          saleId: saleId || null,
          invoiceNo: generateInvoiceNo(type),
          type,
          status: action === "DRAFT" ? "DRAFT" : "SENT",
          subtotal: snapshot.header.subtotal,
          totalDiscount: snapshot.header.totalDiscount,
          taxableAmount: snapshot.header.taxableAmount,
          totalVat: snapshot.header.totalVat,
          total: snapshot.header.grandTotal,
          financialSnapshotStatus: "COMPLETE",
          paymentStatus: "UNPAID",
          paidAmount: 0,
          gibStatus: action === "DRAFT" ? "TASLAK" : "GONDERILDI",
          gibMessage:
            action === "DRAFT"
              ? "Fatura taslak olarak kaydedildi."
              : "Fatura başarıyla gönderildi. Gerçek GİB entegrasyonu bağlandığında bu işlem canlı çalışacaktır.",
        },
      });

      await persistInvoiceFinancialSnapshot(tx, {
        invoiceId: createdInvoice.id,
        items: lineItems,
      });

      if (action !== "DRAFT" && !saleId && customerId) {
        await applyCustomerDebtFromDocument(
          tx,
          companyId!,
          customerId,
          snapshot.header.grandTotal,
          0
        );
      }

      await tx.activityLog.create({
        data: {
          companyId: companyId!,
          userId: userId,
          action: action === "DRAFT" ? "DRAFT" : "SEND",
          module: "e-invoice",
          message: `${createdInvoice.invoiceNo} numaralı ${type === "E_INVOICE" ? "e-Fatura" : "e-Arşiv"} oluşturuldu.`,
        },
      });

      await createNotification(
        {
          companyId: companyId!,
          userId: userId,
          type: action === "DRAFT" ? "INFO" : "SUCCESS",
          category: "INVOICES",
          module: "invoices",
          entityType: "INVOICE",
          entityId: createdInvoice.id,
          actionUrl: `/invoices/${createdInvoice.id}`,
          title:
            action === "DRAFT"
              ? "Fatura taslak kaydedildi"
              : "e-Fatura gönderildi",
          message:
            action === "DRAFT"
              ? `${createdInvoice.invoiceNo} numaralı fatura taslak olarak kaydedildi.`
              : `${createdInvoice.invoiceNo} numaralı fatura başarıyla oluşturuldu.`,
        },
        tx
      );

      return createdInvoice;
    });

    if (action !== "DRAFT") {
      return NextResponse.json(
        buildTenantMutationSuccess(companyId!, {
          reason: "e-invoice-create",
          entity: invoice,
          message: "Fatura başarıyla oluşturuldu.",
          entityIds: { invoiceId: invoice.id },
        }),
      );
    }

    return NextResponse.json({
      success: true,
      message: "Fatura taslak olarak kaydedildi.",
      data: invoice,
    });
  } catch (error) {
    console.error("CREATE_E_INVOICE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Fatura oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
