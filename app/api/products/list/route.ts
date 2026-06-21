import { NextRequest, NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { buildProductTypePrismaFilter, parseProductTypeFilter } from "@/lib/product-type-utils";
import { getWarehouseStockByProductIds } from "@/lib/warehouse-options";
import { resolveWarehouseId } from "@/lib/warehouse-service";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const warehouseIdParam = req.nextUrl.searchParams.get("warehouseId");
    const typeFilter = parseProductTypeFilter(req.nextUrl.searchParams.get("type"));

    const products = await db.product.findMany({
      where: {
        companyId: companyId,
        status: "ACTIVE",
        ...buildProductTypePrismaFilter(typeFilter),
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
        companyId,
        warehouseIdParam
      );

      warehouseStockByProductId = await getWarehouseStockByProductIds(
        companyId,
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
