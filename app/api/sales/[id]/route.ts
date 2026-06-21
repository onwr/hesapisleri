import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { cancelSaleById } from "@/lib/sale-cancel-service";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const patchSchema = z.object({
  action: z.enum(["cancel"]),
});

export async function GET(_req: Request, { params }: Props) {
  try {
    const { id } = await params;

    const auth = await requireApiModuleAccess("sales");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const sale = await db.sale.findFirst({
      where: {
        id,
        companyId: companyId,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        invoice: true,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, message: "Satış bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error("SALE_DETAIL_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Satış bilgisi alınırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("sales");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz işlem." },
        { status: 400 }
      );
    }

    const result = await cancelSaleById(
      id,
      companyId,
      userId
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("SALE_CANCEL_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Satış iptal edilirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
