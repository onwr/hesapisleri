import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { applyCustomerDebtFromDocument } from "@/lib/customer-balance-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

const invoiceItemSchema = z.object({
  name: z.string().min(1, "Ürün / hizmet adı zorunludur."),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().default(20),
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

    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const vatTotal = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + (itemTotal * item.vatRate) / 100;
    }, 0);

    const total = subtotal + vatTotal;

    if (saleId) {
      const existingInvoice = await db.invoice.findFirst({
        where: {
          companyId: payload.companyId!,
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

    const invoice = await db.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          companyId: payload.companyId!,
          customerId: customerId || null,
          saleId: saleId || null,
          invoiceNo: generateInvoiceNo(type),
          type,
          status: action === "DRAFT" ? "DRAFT" : "SENT",
          total,
          paymentStatus: "UNPAID",
          paidAmount: 0,
          gibStatus: action === "DRAFT" ? "TASLAK" : "GONDERILDI",
          gibMessage:
            action === "DRAFT"
              ? "Fatura taslak olarak kaydedildi."
              : "Fatura başarıyla gönderildi. Gerçek GİB entegrasyonu bağlandığında bu işlem canlı çalışacaktır.",
        },
      });

      if (action !== "DRAFT" && !saleId && customerId) {
        await applyCustomerDebtFromDocument(tx, customerId, total, 0);
      }

      await tx.activityLog.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          action: action === "DRAFT" ? "DRAFT" : "SEND",
          module: "e-invoice",
          message: `${createdInvoice.invoiceNo} numaralı ${type === "E_INVOICE" ? "e-Fatura" : "e-Arşiv"} oluşturuldu.`,
        },
      });

      await createNotification(
        {
          companyId: payload.companyId!,
          userId: payload.userId,
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

    return NextResponse.json({
      success: true,
      message:
        action === "DRAFT"
          ? "Fatura taslak olarak kaydedildi."
          : "Fatura başarıyla oluşturuldu.",
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
