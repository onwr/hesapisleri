import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
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

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

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
    const parsed = createNormalInvoiceSchema.safeParse(body);

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
          companyId: payload.companyId,
        },
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, message: "Müşteri bulunamadı." },
          { status: 404 }
        );
      }
    }

    const lineItems = items.map((item) => ({
      id: crypto.randomUUID(),
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
    }));

    const totals = calculateInvoiceTotals(lineItems, discountAmount);
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
      items: lineItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        productId: item.productId,
      })),
    };

    const invoice = await db.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          companyId: payload.companyId!,
          customerId: customerId || null,
          invoiceNo: generateInvoiceNo("NORMAL"),
          type: "NORMAL",
          status,
          total: totals.total,
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

      if (action !== "DRAFT" && customerId) {
        await applyCustomerDebtFromDocument(
          tx,
          customerId,
          totals.total,
          invoicePaidAmount
        );
      }

      await tx.activityLog.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          action: action === "DRAFT" ? "DRAFT" : "CREATE",
          module: "invoices",
          message: `${createdInvoice.invoiceNo} numaralı normal fatura ${action === "DRAFT" ? "taslak olarak kaydedildi" : "oluşturuldu"}.`,
        },
      });

      await tx.notification.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          type: action === "DRAFT" ? "INFO" : "SUCCESS",
          title:
            action === "DRAFT"
              ? "Fatura taslağı kaydedildi"
              : "Normal fatura oluşturuldu",
          message:
            action === "DRAFT"
              ? `${createdInvoice.invoiceNo} numaralı fatura taslak olarak kaydedildi.`
              : `${createdInvoice.invoiceNo} numaralı fatura kaydı oluşturuldu.`,
        },
      });

      return createdInvoice;
    });

    return NextResponse.json({
      success: true,
      message:
        action === "DRAFT"
          ? "Fatura taslak olarak kaydedildi."
          : "Fatura başarıyla oluşturuldu.",
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
