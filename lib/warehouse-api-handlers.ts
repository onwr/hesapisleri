import { NextResponse } from "next/server";
import {
  requireApiWarehouseManage,
  requireApiWarehouseRead,
} from "@/lib/module-access";
import {
  createCompanyWarehouse,
  deactivateCompanyWarehouse,
  listCompanyWarehouses,
  setDefaultCompanyWarehouse,
  updateCompanyWarehouse,
} from "@/lib/warehouse-admin-service";
import { db } from "@/lib/prisma";
import {
  requireCompanyFeature,
  requireCompanyLimit,
} from "@/lib/billing/entitlements/entitlement-enforcement-service";
import { EntitlementError } from "@/lib/billing/entitlements/entitlement-errors";

function toJsonResponse(result: Awaited<ReturnType<typeof createCompanyWarehouse>>) {
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        errors: result.errors,
      },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    data: result.data,
  });
}

export async function warehouseListHandler() {
  try {
    const auth = await requireApiWarehouseRead();
    if ("error" in auth) return auth.error;

    const data = await listCompanyWarehouses(auth.companyId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("WAREHOUSES_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depolar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function warehouseCreateHandler(req: Request) {
  try {
    const auth = await requireApiWarehouseManage();
    if ("error" in auth) return auth.error;

    const body = await req.json();

    const warehouseCount = await db.warehouse.count({
      where: { companyId: auth.companyId },
    });
    try {
      if (warehouseCount >= 1) {
        await requireCompanyFeature(auth.companyId, "MULTI_WAREHOUSE");
      }
      await requireCompanyLimit(auth.companyId, "MAX_WAREHOUSES", { incrementBy: 1 });
    } catch (error) {
      if (error instanceof EntitlementError) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: error.status }
        );
      }
      throw error;
    }

    const result = await createCompanyWarehouse(
      auth.companyId,
      auth.userId,
      body
    );

    return toJsonResponse(result);
  } catch (error) {
    console.error("WAREHOUSES_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depo oluşturulamadı." },
      { status: 500 }
    );
  }
}

export async function warehouseUpdateHandler(req: Request, id: string) {
  try {
    const auth = await requireApiWarehouseManage();
    if ("error" in auth) return auth.error;

    const body = await req.json();

    if (body?.action === "setDefault") {
      const result = await setDefaultCompanyWarehouse(auth.companyId, id);
      return toJsonResponse(result);
    }

    const result = await updateCompanyWarehouse(auth.companyId, id, body);
    return toJsonResponse(result);
  } catch (error) {
    console.error("WAREHOUSE_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depo güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function warehouseDeleteHandler(id: string) {
  try {
    const auth = await requireApiWarehouseManage();
    if ("error" in auth) return auth.error;

    const result = await deactivateCompanyWarehouse(auth.companyId, id);
    return toJsonResponse(result);
  } catch (error) {
    console.error("WAREHOUSE_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depo işlemi tamamlanamadı." },
      { status: 500 }
    );
  }
}

export async function warehouseGetHandler(id: string) {
  try {
    const auth = await requireApiWarehouseRead();
    if ("error" in auth) return auth.error;

    const warehouses = await listCompanyWarehouses(auth.companyId);
    const warehouse = warehouses.find((item) => item.id === id);

    if (!warehouse) {
      return NextResponse.json(
        { success: false, message: "Depo bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: warehouse });
  } catch (error) {
    console.error("WAREHOUSE_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Depo yüklenemedi." },
      { status: 500 }
    );
  }
}
