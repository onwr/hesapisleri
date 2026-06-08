import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { moveStockBetweenWarehouses } from "@/lib/warehouse-service";
import { warehouseTransferSchema } from "@/lib/warehouse-utils";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    const transfers = await db.warehouseTransfer.findMany({
      where: {
        companyId: auth.companyId,
        ...(productId ? { productId } : {}),
      },
      include: {
        product: { select: { id: true, name: true } },
        fromWarehouse: { select: { id: true, name: true } },
        toWarehouse: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: transfers });
  } catch (error) {
    console.error("STOCKS_TRANSFERS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Transferler yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = warehouseTransferSchema.safeParse(body);

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

    const result = await moveStockBetweenWarehouses({
      companyId: auth.companyId,
      userId: auth.userId,
      ...parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Depo transferi tamamlandı.",
      data: result.data,
    });
  } catch (error) {
    console.error("STOCKS_TRANSFERS_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Transfer oluşturulamadı." },
      { status: 500 }
    );
  }
}
