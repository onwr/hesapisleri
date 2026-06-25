import { NextResponse } from "next/server";
import { requireApiModuleAccess, requireApiSalesAction } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import {
  updateSaleById,
  updateSaleSchema,
} from "@/lib/sale-update-service";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: Props) {
  try {
    const { id } = await params;

    const auth = await requireApiModuleAccess("sales");
    if ("error" in auth) return auth.error;

    const sale = await db.sale.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        invoice: {
          include: {
            documentSubmission: true,
          },
        },
        cancelledByUser: {
          select: {
            id: true,
            name: true,
          },
        },
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
    const auth = await requireApiSalesAction("update");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = updateSaleSchema.safeParse(body);

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

    const result = await updateSaleById({
      saleId: id,
      companyId: auth.companyId,
      userId: auth.userId,
      data: parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("SALE_UPDATE_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Satış güncellenirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
