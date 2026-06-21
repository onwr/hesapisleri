import { db } from "@/lib/prisma";
import {
  buildWarehouseMetrics,
  getOrCreateDefaultWarehouse,
} from "@/lib/warehouse-service";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
} from "@/lib/warehouse-utils";

export type WarehouseServiceResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; status: number; message: string; errors?: Record<string, string[]> };

export function buildWarehouseAddress(input: {
  city?: string | null;
  district?: string | null;
  address?: string | null;
}) {
  const parts = [input.city?.trim(), input.district?.trim(), input.address?.trim()].filter(
    Boolean
  ) as string[];

  return parts.length > 0 ? parts.join(", ") : null;
}

export function parseWarehouseAddress(address: string | null | undefined) {
  if (!address) {
    return { city: "", district: "", address: "" };
  }

  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 3) {
    return {
      city: parts[0] ?? "",
      district: parts[1] ?? "",
      address: parts.slice(2).join(", "),
    };
  }

  if (parts.length === 2) {
    return {
      city: parts[0] ?? "",
      district: parts[1] ?? "",
      address: "",
    };
  }

  return { city: "", district: "", address: parts[0] ?? "" };
}

export async function listCompanyWarehouses(companyId: string) {
  await getOrCreateDefaultWarehouse(companyId);

  const warehouses = await db.warehouse.findMany({
    where: { companyId },
    include: {
      stocks: {
        include: {
          product: {
            select: { buyPrice: true, productType: true, minStock: true, stock: true },
          },
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return warehouses.map((warehouse) => ({
    ...warehouse,
    metrics: buildWarehouseMetrics(warehouse),
  }));
}

export async function createCompanyWarehouse(
  companyId: string,
  userId: string,
  body: unknown
): Promise<WarehouseServiceResult> {
  const parsed = createWarehouseSchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: "Bilgileri kontrol edin.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data as CreateWarehouseInput;
  const name = input.name.trim();

  if (!name) {
    return {
      ok: false,
      status: 400,
      message: "Depo adı zorunludur.",
      errors: { name: ["Depo adı zorunludur."] },
    };
  }

  const existing = await db.warehouse.findFirst({
    where: {
      companyId,
      name,
    },
  });

  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Bu isimde bir depo zaten var.",
    };
  }

  const warehouseCount = await db.warehouse.count({ where: { companyId } });
  const shouldDefault = input.isDefault ?? warehouseCount === 0;

  const warehouse = await db.$transaction(async (tx) => {
    if (shouldDefault) {
      await tx.warehouse.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.warehouse.create({
      data: {
        companyId,
        name,
        code: input.code?.trim() || null,
        address: buildWarehouseAddress(input),
        note: input.note?.trim() || input.description?.trim() || null,
        isDefault: shouldDefault,
        status: "ACTIVE",
      },
    });
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId,
      action: "CREATE",
      module: "stocks",
      message: `${warehouse.name} deposu oluşturuldu.`,
    },
  });

  return {
    ok: true,
    message: "Depo oluşturuldu.",
    data: warehouse,
  };
}

export async function updateCompanyWarehouse(
  companyId: string,
  warehouseId: string,
  body: unknown
): Promise<WarehouseServiceResult> {
  const parsed = updateWarehouseSchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: "Bilgileri kontrol edin.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data as UpdateWarehouseInput;

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    include: {
      stocks: { where: { quantity: { gt: 0 } } },
    },
  });

  if (!warehouse) {
    return {
      ok: false,
      status: 404,
      message: "Depo bulunamadı.",
    };
  }

  if (input.name) {
    const duplicate = await db.warehouse.findFirst({
      where: {
        companyId,
        name: input.name.trim(),
        NOT: { id: warehouseId },
      },
    });

    if (duplicate) {
      return {
        ok: false,
        status: 409,
        message: "Bu isimde bir depo zaten var.",
      };
    }
  }

  if (input.status === "PASSIVE" && warehouse.isDefault) {
    return {
      ok: false,
      status: 400,
      message: "Varsayılan depo pasif yapılamaz.",
    };
  }

  const updated = await db.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.warehouse.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const nextAddress =
      input.city !== undefined ||
      input.district !== undefined ||
      input.address !== undefined
        ? buildWarehouseAddress({
            city: input.city ?? parseWarehouseAddress(warehouse.address).city,
            district:
              input.district ?? parseWarehouseAddress(warehouse.address).district,
            address:
              input.address ?? parseWarehouseAddress(warehouse.address).address,
          })
        : undefined;

    return tx.warehouse.update({
      where: { id: warehouseId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code?.trim() || null } : {}),
        ...(nextAddress !== undefined ? { address: nextAddress } : {}),
        ...(input.note !== undefined || input.description !== undefined
          ? {
              note:
                input.note?.trim() ||
                input.description?.trim() ||
                null,
            }
          : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
  });

  return {
    ok: true,
    message: "Depo güncellendi.",
    data: updated,
  };
}

export async function deactivateCompanyWarehouse(
  companyId: string,
  warehouseId: string
): Promise<WarehouseServiceResult> {
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    include: {
      stocks: { where: { quantity: { gt: 0 } } },
    },
  });

  if (!warehouse) {
    return {
      ok: false,
      status: 404,
      message: "Depo bulunamadı.",
    };
  }

  if (warehouse.isDefault) {
    return {
      ok: false,
      status: 400,
      message: "Varsayılan depo pasif yapılamaz.",
    };
  }

  if (warehouse.stocks.length > 0) {
    return {
      ok: false,
      status: 400,
      message: "Depoda stok bulunduğu için silinemez. Pasife almayı deneyin.",
    };
  }

  await db.warehouse.update({
    where: { id: warehouseId },
    data: { status: "PASSIVE" },
  });

  return {
    ok: true,
    message: "Depo pasife alındı.",
    data: { id: warehouseId },
  };
}

export async function setDefaultCompanyWarehouse(
  companyId: string,
  warehouseId: string
): Promise<WarehouseServiceResult> {
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, companyId },
  });

  if (!warehouse) {
    return {
      ok: false,
      status: 404,
      message: "Depo bulunamadı.",
    };
  }

  if (warehouse.status !== "ACTIVE") {
    return {
      ok: false,
      status: 400,
      message: "Pasif depo varsayılan yapılamaz.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.warehouse.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    });

    await tx.warehouse.update({
      where: { id: warehouseId },
      data: { isDefault: true, status: "ACTIVE" },
    });
  });

  return {
    ok: true,
    message: "Varsayılan depo güncellendi.",
    data: { id: warehouseId },
  };
}
