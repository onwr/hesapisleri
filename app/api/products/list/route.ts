import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { getWarehouseStockByProductIds } from "@/lib/warehouse-options";
import { resolveWarehouseId } from "@/lib/warehouse-service";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export async function GET(req: NextRequest) {
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

    const warehouseIdParam = req.nextUrl.searchParams.get("warehouseId");

    const products = await db.product.findMany({
      where: {
        companyId: payload.companyId,
        status: "ACTIVE",
      },
      include: {
        category: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let warehouseStockByProductId: Record<string, number> | null = null;

    if (warehouseIdParam) {
      const resolvedWarehouseId = await resolveWarehouseId(
        payload.companyId,
        warehouseIdParam
      );

      warehouseStockByProductId = await getWarehouseStockByProductIds(
        payload.companyId,
        resolvedWarehouseId,
        products.map((product) => product.id)
      );
    }

    const data = products.map((product) => ({
      ...product,
      warehouseStock: warehouseStockByProductId
        ? (warehouseStockByProductId[product.id] ?? 0)
        : undefined,
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("PRODUCTS_LIST_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Ürünler listelenirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
