import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { generateQuoteNo } from "@/lib/sale-number-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

const saleItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, "Ürün adı zorunludur."),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().default(20),
});

const createQuoteSchema = z.object({
  customerId: z.string().optional(),
  note: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "En az bir ürün ekleyin."),
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
    const parsed = createQuoteSchema.safeParse(body);

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

    const { customerId, note, items } = parsed.data;

    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const vatTotal = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + (itemTotal * item.vatRate) / 100;
    }, 0);

    const total = subtotal + vatTotal;

    const quote = await db.$transaction(async (tx) => {
      const createdQuote = await tx.sale.create({
        data: {
          companyId: payload.companyId!,
          customerId: customerId || null,
          userId: payload.userId,
          saleNo: generateQuoteNo(),
          subtotal,
          vatTotal,
          discount: 0,
          total,
          paymentStatus: "UNPAID",
          paidAmount: 0,
          status: "DRAFT",
          sourceChannel: "MANUAL",
          orderStatus: "WAITING",
          note: note || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId || null,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          action: "CREATE",
          module: "sales",
          message: `${createdQuote.saleNo} numaralı teklif oluşturuldu.`,
        },
      });

      return createdQuote;
    });

    return NextResponse.json({
      success: true,
      message: "Teklif başarıyla oluşturuldu.",
      data: { id: quote.id },
    });
  } catch (error) {
    console.error("CREATE_QUOTE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Teklif oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
