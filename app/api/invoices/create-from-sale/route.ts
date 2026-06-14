import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  generateInvoiceNo,
  getMockGibMeta,
  resolveInvoiceStatusForType,
} from "@/lib/invoices/mock-gib";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

const createFromSaleSchema = z.object({
  saleId: z.string().min(1, "Satış seçilmelidir."),
  type: z.enum(["NORMAL", "E_INVOICE", "E_ARCHIVE"]).default("NORMAL"),
  status: z
    .enum(["DRAFT", "SENT", "APPROVED", "CANCELLED", "ERROR"])
    .optional(),
});

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
        companyId: payload.companyId,
      },
      include: {
        invoice: true,
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

    const gib = getMockGibMeta(type, status);

    const invoice = await db.invoice.create({
      data: {
        companyId: payload.companyId,
        customerId: sale.customerId,
        saleId: sale.id,
        invoiceNo: generateInvoiceNo(type),
        type,
        status,
        total: sale.total,
        paymentStatus: sale.paymentStatus,
        gibStatus: gib.gibStatus,
        gibMessage: gib.gibMessage,
      },
      include: {
        customer: true,
        sale: true,
      },
    });

    await db.activityLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        action: "CREATE",
        module: "invoices",
        message: `${invoice.invoiceNo} satıştan fatura oluşturuldu.`,
      },
    });

    await createNotification({
      companyId: payload.companyId,
      userId: payload.userId,
      type: status === "ERROR" ? "WARNING" : "SUCCESS",
      category: "INVOICES",
      module: "invoices",
      entityType: "INVOICE",
      entityId: invoice.id,
      actionUrl: `/invoices/${invoice.id}`,
      title: "Satıştan fatura oluşturuldu",
      message: `${invoice.invoiceNo} numaralı fatura kaydı oluşturuldu.`,
    });

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
