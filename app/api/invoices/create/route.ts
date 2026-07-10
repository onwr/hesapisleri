import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { calculateInvoiceTotals } from "@/lib/invoice-form-utils";
import { applyCustomerDebtFromDocument } from "@/lib/customer-balance-utils";
import { resolveSalePayment } from "@/lib/sale-payment-utils";
import {
  encodeNormalInvoiceMeta,
  type NormalInvoiceMeta,
} from "@/lib/normal-invoice-meta";
import {
  generateInvoiceNo,
  getMockGibMeta,
} from "@/lib/invoices/mock-gib";
import { persistInvoiceFinancialSnapshot } from "@/lib/invoice-snapshot-service";
import { calculateInvoiceLineSnapshots } from "@/lib/invoice-tax-calculation-utils";
import { buildZodValidationErrorBody } from "@/lib/api-zod-validation";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

const invoiceItemSchema = z.object({
  name: z.string().min(1, "Ürün / hizmet adı zorunludur."),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().default(20),
  productId: z.string().optional(),
});

const createNormalInvoiceSchema = z.object({
  customerId: z.string().optional(),
  documentLabel: z.enum(["SATIS", "HIZMET", "PROFORMA"]).default("SATIS"),
  currency: z.enum(["TRY"]).default("TRY"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  paymentStatus: z
    .enum(["PAID", "UNPAID", "PARTIAL", "FAILED"])
    .default("UNPAID"),
  collectedAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).default(0),
  action: z.enum(["DRAFT", "CREATE"]).default("CREATE"),
  items: z.array(invoiceItemSchema).min(1, "En az bir kalem ekleyin."),
});

function parseDateInput(value?: string) {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const body = await req.json();
    const parsed = createNormalInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildZodValidationErrorBody(parsed.error), {
        status: 400,
      });
    }

    const {
      customerId,
      documentLabel,
      currency,
      invoiceDate,
      dueDate,
      paymentStatus,
      discountAmount,
      action,
      items,
    } = parsed.data;

    if (customerId) {
      const customer = await db.customer.findFirst({
        where: {
          id: customerId,
          companyId: companyId,
        },
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, message: "Müşteri bulunamadı." },
          { status: 404 }
        );
      }
    }

    const productIds = items
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id));

    const products =
      productIds.length > 0
        ? await db.product.findMany({
            where: {
              companyId: companyId,
              id: { in: productIds },
            },
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unitType: true,
            },
          })
        : [];

    const productMap = new Map(products.map((product) => [product.id, product]));

    const lineItems = items.map((item) => {
      const product = item.productId
        ? productMap.get(item.productId)
        : undefined;

      return {
        productId: item.productId,
        productName: item.name,
        sku: product?.sku ?? null,
        barcode: product?.barcode ?? null,
        unit: product?.unitType ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
      };
    });

    const totals = calculateInvoiceTotals(
      lineItems.map((item) => ({
        id: crypto.randomUUID(),
        name: item.productName,
        ...item,
      })),
      discountAmount
    );
    const lineSnapshots = calculateInvoiceLineSnapshots(
      lineItems,
      discountAmount
    );

    const status = action === "DRAFT" ? "DRAFT" : "SENT";
    const gib = getMockGibMeta("NORMAL", status);

    let invoicePaidAmount = 0;

    if (
      paymentStatus === "PAID" ||
      paymentStatus === "UNPAID" ||
      paymentStatus === "PARTIAL"
    ) {
      try {
        const payment = resolveSalePayment({
          paymentStatus,
          total: totals.total,
          collectedAmount:
            parsed.data.collectedAmount ?? parsed.data.paidAmount,
        });
        invoicePaidAmount = payment.paidAmount;
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Ödeme bilgileri geçersiz.",
          },
          { status: 400 }
        );
      }
    }

    const meta: NormalInvoiceMeta = {
      v: 1,
      documentLabel,
      currency,
      invoiceDate: invoiceDate ?? new Date().toISOString().slice(0, 10),
      discountAmount: totals.discount,
      subtotal: totals.subtotal,
      taxableAmount: totals.taxableAmount,
      totalVat: totals.totalVat,
      grandTotal: totals.grandTotal,
      items: lineItems.map((item, index) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        productId: item.productId,
        lineNetAmount: lineSnapshots[index]!.lineNetAmount,
        vatAmount: lineSnapshots[index]!.vatAmount,
        lineGrossAmount: lineSnapshots[index]!.lineGrossAmount,
        discountAmount: lineSnapshots[index]!.discountAmount,
      })),
    };

    const invoice = await db.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          companyId: companyId!,
          customerId: customerId || null,
          invoiceNo: generateInvoiceNo("NORMAL"),
          type: "NORMAL",
          status,
          subtotal: totals.subtotal,
          totalDiscount: totals.discount,
          taxableAmount: totals.taxableAmount,
          totalVat: totals.totalVat,
          total: totals.total,
          financialSnapshotStatus: "COMPLETE",
          paymentStatus,
          paidAmount: invoicePaidAmount,
          dueDate: parseDateInput(dueDate),
          gibStatus: gib.gibStatus,
          gibMessage: encodeNormalInvoiceMeta(gib.gibMessage, meta),
        },
        include: {
          customer: true,
        },
      });

      await persistInvoiceFinancialSnapshot(tx, {
        invoiceId: createdInvoice.id,
        items: lineItems,
        invoiceDiscountAmount: discountAmount,
      });

      if (action !== "DRAFT" && customerId) {
        await applyCustomerDebtFromDocument(
          tx,
          companyId!,
          customerId,
          totals.total,
          invoicePaidAmount
        );
      }

      await tx.activityLog.create({
        data: {
          companyId: companyId!,
          userId: userId,
          action: action === "DRAFT" ? "DRAFT" : "CREATE",
          module: "invoices",
          message: `${createdInvoice.invoiceNo} numaralı normal fatura ${action === "DRAFT" ? "taslak olarak kaydedildi" : "oluşturuldu"}.`,
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
              ? "Fatura taslağı kaydedildi"
              : "Normal fatura oluşturuldu",
          message:
            action === "DRAFT"
              ? `${createdInvoice.invoiceNo} numaralı fatura taslak olarak kaydedildi.`
              : `${createdInvoice.invoiceNo} numaralı fatura kaydı oluşturuldu.`,
        },
        tx
      );

      return createdInvoice;
    });

    if (action !== "DRAFT") {
      return NextResponse.json(
        buildTenantMutationSuccess(companyId!, {
          reason: "invoice-create",
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
    console.error("CREATE_NORMAL_INVOICE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Fatura oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
