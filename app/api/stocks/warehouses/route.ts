import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import {
  buildWarehouseMetrics,
  getOrCreateDefaultWarehouse,
} from "@/lib/warehouse-service";
import { createWarehouseSchema } from "@/lib/warehouse-utils";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    await getOrCreateDefaultWarehouse(auth.companyId);

    const warehouses = await db.warehouse.findMany({
      where: { companyId: auth.companyId },
      include: {
        stocks: {
          include: {
            product: {
              select: { sellPrice: true, minStock: true, stock: true },
            },
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: warehouses.map((warehouse) => ({
        ...warehouse,
        metrics: buildWarehouseMetrics(warehouse),
      })),
    });
  } catch (error) {
    console.error("STOCKS_WAREHOUSES_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depolar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = createWarehouseSchema.safeParse(body);

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

    const existing = await db.warehouse.findFirst({
      where: {
        companyId: auth.companyId,
        name: parsed.data.name.trim(),
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Bu depo adı zaten kullanılıyor." },
        { status: 400 }
      );
    }

    const warehouse = await db.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.warehouse.updateMany({
          where: { companyId: auth.companyId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.create({
        data: {
          companyId: auth.companyId,
          name: parsed.data.name.trim(),
          code: parsed.data.code?.trim() || null,
          address: parsed.data.address?.trim() || null,
          note: parsed.data.note?.trim() || null,
          isDefault: parsed.data.isDefault ?? false,
          status: "ACTIVE",
        },
      });
    });

    await db.activityLog.create({
      data: {
        companyId: auth.companyId,
        userId: auth.userId,
        action: "CREATE",
        module: "stocks",
        message: `${warehouse.name} deposu oluşturuldu.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Depo oluşturuldu.",
      data: warehouse,
    });
  } catch (error) {
    console.error("STOCKS_WAREHOUSES_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depo oluşturulamadı." },
      { status: 500 }
    );
  }
}
