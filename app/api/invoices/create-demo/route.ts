import { NextResponse } from "next/server";
import { z } from "zod";
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

const createDemoSchema = z.object({
  type: z.enum(["NORMAL", "E_INVOICE", "E_ARCHIVE"]).default("E_INVOICE"),
  status: z
    .enum(["DRAFT", "SENT", "APPROVED", "CANCELLED", "ERROR"])
    .optional(),
  customerId: z.string().optional(),
  total: z.number().min(0).optional(),
  paymentStatus: z
    .enum(["PAID", "UNPAID", "PARTIAL", "FAILED"])
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
    const parsed = createDemoSchema.safeParse(body);

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

    const { type, customerId, total, paymentStatus } = parsed.data;
    const status = resolveInvoiceStatusForType(type, parsed.data.status);
    const gib = getMockGibMeta(type, status);

    let resolvedCustomerId = customerId || null;

    if (resolvedCustomerId) {
      const customer = await db.customer.findFirst({
        where: {
          id: resolvedCustomerId,
          companyId: payload.companyId,
        },
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, message: "Müşteri bulunamadı." },
          { status: 404 }
        );
      }
    } else {
      const firstCustomer = await db.customer.findFirst({
        where: { companyId: payload.companyId },
        orderBy: { createdAt: "desc" },
      });
      resolvedCustomerId = firstCustomer?.id ?? null;
    }

    const invoiceTotal =
      total ??
      (type === "E_ARCHIVE" ? 8450 : type === "E_INVOICE" ? 15750 : 5200);

    const invoice = await db.invoice.create({
      data: {
        companyId: payload.companyId,
        customerId: resolvedCustomerId,
        invoiceNo: generateInvoiceNo(type),
        type,
        status,
        total: invoiceTotal,
        paymentStatus: paymentStatus ?? "UNPAID",
        gibStatus: gib.gibStatus,
        gibMessage: gib.gibMessage,
      },
      include: {
        customer: true,
      },
    });

    await db.activityLog.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        action: "CREATE",
        module: "invoices",
        message: `${invoice.invoiceNo} demo fatura oluşturuldu.`,
      },
    });

    await db.notification.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        type: status === "ERROR" ? "WARNING" : "INFO",
        title: "Demo fatura oluşturuldu",
        message: `${invoice.invoiceNo} kaydı simülasyon olarak eklendi.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demo fatura oluşturuldu.",
      data: invoice,
    });
  } catch (error) {
    console.error("CREATE_DEMO_INVOICE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Demo fatura oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
