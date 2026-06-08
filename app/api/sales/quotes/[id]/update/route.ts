import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { isQuoteSaleStatus } from "@/lib/sale-query-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const saleItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, "Ürün adı zorunludur."),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().default(20),
});

const updateQuoteSchema = z.object({
  customerId: z.string().optional(),
  note: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "En az bir ürün ekleyin."),
});

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
    const parsed = updateQuoteSchema.safeParse(body);

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

    const sale = await db.sale.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, message: "Teklif bulunamadı." },
        { status: 404 }
      );
    }

    if (!isQuoteSaleStatus(sale.status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Sadece taslak teklifler düzenlenebilir.",
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

    const updatedQuote = await db.$transaction(async (tx) => {
      await tx.saleItem.deleteMany({
        where: { saleId: sale.id },
      });

      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: {
          customerId: customerId || null,
          note: note ?? null,
          subtotal,
          vatTotal,
          total,
          paymentStatus: "UNPAID",
          paidAmount: 0,
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
        include: {
          items: true,
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          action: "UPDATE",
          module: "sales",
          message: `${sale.saleNo} numaralı teklif güncellendi.`,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Teklif başarıyla güncellendi.",
      data: { id: updatedQuote.id },
    });
  } catch (error) {
    console.error("UPDATE_QUOTE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Teklif güncellenirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
