import { db } from "@/lib/prisma";
import { requireCompanyLimit } from "@/lib/billing/entitlements/entitlement-enforcement-service";
import { EntitlementError } from "@/lib/billing/entitlements/entitlement-errors";
import {
  formatProductValidationErrors,
  getFirstProductErrorMessage,
  normalizeImageUrl,
  normalizeOptionalText,
  PRODUCT_UNIT_LABELS,
  productFormSchema,
  productUpdateSchema,
  type ProductUnitType,
} from "@/lib/product-form-utils";
import {
  assertUniqueProductIdentifiers,
  deleteProduct,
  resolveProductCategoryId,
  toggleProductStatus,
} from "@/lib/product-service";
import { isServiceProductType, normalizeServiceProductFields } from "@/lib/product-type-utils";
import { isLowStock, resolveProductMinStock } from "@/lib/stocks-page-utils";
import { getProductStockByWarehouses } from "@/lib/warehouse-service";
import { applyWarehouseStockMovement } from "@/lib/warehouse-service";
import { MobileCatalogError } from "./mobile-catalog-errors";
import {
  resolveMobileCatalogPermissions,
  type MobileCatalogPermissions,
} from "./mobile-catalog-permissions";

const LIST_PAGE_SIZE = 24;

function mapUnit(unitType: string) {
  return PRODUCT_UNIT_LABELS[unitType as ProductUnitType] ?? unitType;
}

function stripProductForMobile(
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    description: string | null;
    imageUrl: string | null;
    stock: number;
    minStock: number;
    productType: string;
    buyPrice: unknown;
    sellPrice: unknown;
    vatRate: number;
    status: string;
    unitType: string;
    warehouseLocation: string | null;
    category: { name: string } | null;
  },
  permissions: MobileCatalogPermissions
) {
  const minStock = resolveProductMinStock(product.minStock);
  const stockTracked = !isServiceProductType(product.productType);
  const totalStock = product.stock;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    category: product.category?.name ?? "Genel",
    productType: product.productType,
    status: product.status,
    sellPrice: Number(product.sellPrice),
    vatRate: product.vatRate,
    totalStock,
    minStock,
    lowStock: stockTracked && isLowStock(totalStock, minStock),
    stockTracked,
    unit: mapUnit(product.unitType),
    unitType: product.unitType,
    imageUrl: product.imageUrl,
    ...(permissions.products.viewCostPrice
      ? { buyPrice: Number(product.buyPrice) }
      : {}),
  };
}

export async function listMobileProducts(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  q?: string;
  category?: string;
  status?: string;
  productType?: string;
  lowStock?: boolean;
  hasBarcode?: boolean;
  sort?: string;
  cursor?: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.products.read) {
    throw new MobileCatalogError("FORBIDDEN", "Ürün görüntüleme yetkiniz yok.", 403);
  }

  const q = input.q?.trim() ?? "";
  const where = {
    companyId: input.companyId,
    ...(input.status ? { status: input.status as "ACTIVE" | "PASSIVE" } : {}),
    ...(input.productType
      ? { productType: input.productType as "STOCK" | "SERVICE" }
      : {}),
    ...(input.category
      ? { category: { name: { equals: input.category, mode: "insensitive" as const } } }
      : {}),
    ...(input.hasBarcode === true ? { barcode: { not: null } } : {}),
    ...(input.hasBarcode === false ? { barcode: null } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { sku: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q } },
          ],
        }
      : {}),
  };

  const products = await db.product.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy:
      input.sort === "name"
        ? { name: "asc" }
        : input.sort === "stock"
          ? { stock: "asc" }
          : { createdAt: "desc" },
    take: LIST_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  let items = products.map((p) => stripProductForMobile(p, permissions));
  if (input.lowStock) {
    items = items.filter((p) => p.stockTracked && p.lowStock);
  }

  const hasMore = items.length > LIST_PAGE_SIZE;
  if (hasMore) items = items.slice(0, LIST_PAGE_SIZE);

  return {
    permissions,
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getMobileProductById(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  productId: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.products.read) {
    throw new MobileCatalogError("FORBIDDEN", "Ürün görüntüleme yetkiniz yok.", 403);
  }

  const product = await db.product.findFirst({
    where: { id: input.productId, companyId: input.companyId },
    include: { category: { select: { name: true } } },
  });

  if (!product) {
    throw new MobileCatalogError("PRODUCT_NOT_FOUND", "Ürün bulunamadı.", 404);
  }

  const stockTracked = !isServiceProductType(product.productType);
  const warehouseStocks = stockTracked
    ? await getProductStockByWarehouses(input.companyId, product.id)
    : [];

  const movements = stockTracked
    ? await db.stockMovement.findMany({
        where: { companyId: input.companyId, productId: product.id },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          type: true,
          quantity: true,
          note: true,
          createdAt: true,
          warehouse: { select: { id: true, name: true } },
        },
      })
    : [];

  const base = stripProductForMobile(product, permissions);

  return {
    permissions,
    product: {
      ...base,
      description: product.description,
      warehouseLocation: product.warehouseLocation,
      warehouseStocks: warehouseStocks.map((w) => ({
        warehouseId: w.warehouse.id,
        warehouseName: w.warehouse.name,
        quantity: w.quantity,
        lowStock: isLowStock(w.quantity, base.minStock),
      })),
      recentMovements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: m.quantity,
        note: m.note,
        createdAt: m.createdAt.toISOString(),
        warehouseName: m.warehouse?.name ?? null,
      })),
    },
  };
}

export async function findMobileProductByBarcode(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  barcode: string;
}) {
  const normalized = input.barcode.trim();
  if (!normalized) {
    throw new MobileCatalogError("VALIDATION_ERROR", "Barkod gerekli.", 400);
  }

  const product = await db.product.findFirst({
    where: { companyId: input.companyId, barcode: normalized, status: "ACTIVE" },
    include: { category: { select: { name: true } } },
  });

  if (!product) {
    throw new MobileCatalogError("PRODUCT_NOT_FOUND", "Bu barkodla ürün bulunamadı.", 404);
  }

  return getMobileProductById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    productId: product.id,
  });
}

export async function createMobileProduct(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.products.create) {
    throw new MobileCatalogError("FORBIDDEN", "Ürün oluşturma yetkiniz yok.", 403);
  }

  const parsed = productFormSchema.safeParse(input.body);
  if (!parsed.success) {
    const fieldErrors = formatProductValidationErrors(
      parsed.error.flatten().fieldErrors
    );
    throw new MobileCatalogError(
      "VALIDATION_ERROR",
      getFirstProductErrorMessage("Bilgileri kontrol edin.", fieldErrors),
      400,
      fieldErrors
    );
  }

  if (!permissions.products.viewCostPrice && parsed.data.buyPrice > 0) {
    throw new MobileCatalogError("FORBIDDEN", "Maliyet fiyatı gönderme yetkiniz yok.", 403);
  }

  const data = normalizeServiceProductFields(parsed.data);
  const isService = data.productType === "SERVICE";
  const sku = normalizeOptionalText(data.sku);
  const hasBarcodeField = Object.prototype.hasOwnProperty.call(input.body, "barcode");
  const barcode =
    isService || !hasBarcodeField ? null : normalizeOptionalText(data.barcode ?? null);

  const uniqueCheck = await assertUniqueProductIdentifiers(input.companyId, { sku, barcode });
  if (!uniqueCheck.ok) {
    throw new MobileCatalogError(
      uniqueCheck.field === "barcode" ? "PRODUCT_BARCODE_EXISTS" : "PRODUCT_SKU_EXISTS",
      uniqueCheck.message,
      uniqueCheck.field === "barcode" ? 409 : 400
    );
  }

  const categoryId = await resolveProductCategoryId(input.companyId, data.categoryName);

  try {
    await requireCompanyLimit(input.companyId, "MAX_PRODUCTS", { incrementBy: 1 });
  } catch (error) {
    if (error instanceof EntitlementError) {
      throw new MobileCatalogError("FORBIDDEN", error.message, error.status);
    }
    throw error;
  }

  const product = await db.product.create({
    data: {
      companyId: input.companyId,
      categoryId,
      productType: data.productType,
      name: data.name,
      sku,
      barcode,
      description: normalizeOptionalText(data.description),
      imageUrl: normalizeImageUrl(data.imageUrl),
      stock: isService ? 0 : data.stock,
      minStock: isService ? 0 : data.minStock,
      unitType: data.unitType,
      warehouseLocation: isService ? null : normalizeOptionalText(data.warehouseLocation),
      buyPrice: permissions.products.viewCostPrice ? data.buyPrice : 0,
      sellPrice: data.sellPrice,
      vatRate: data.vatRate,
      status: data.status,
    },
    include: { category: { select: { name: true } } },
  });

  if (!isService && data.stock > 0) {
    await applyWarehouseStockMovement({
      companyId: input.companyId,
      userId: input.userId,
      productId: product.id,
      input: { type: "IN", quantity: data.stock, note: "İlk stok girişi" },
    });
  }

  return getMobileProductById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    productId: product.id,
  });
}

export async function updateMobileProduct(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  productId: string;
  body: unknown;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.products.update) {
    throw new MobileCatalogError("FORBIDDEN", "Ürün güncelleme yetkiniz yok.", 403);
  }

  const existing = await db.product.findFirst({
    where: { id: input.productId, companyId: input.companyId },
  });
  if (!existing) {
    throw new MobileCatalogError("PRODUCT_NOT_FOUND", "Ürün bulunamadı.", 404);
  }

  const parsed = productUpdateSchema.safeParse(input.body);
  if (!parsed.success) {
    const fieldErrors = formatProductValidationErrors(
      parsed.error.flatten().fieldErrors
    );
    throw new MobileCatalogError(
      "VALIDATION_ERROR",
      getFirstProductErrorMessage("Bilgileri kontrol edin.", fieldErrors),
      400,
      fieldErrors
    );
  }

  if (!permissions.products.viewCostPrice && parsed.data.buyPrice !== Number(existing.buyPrice)) {
    throw new MobileCatalogError("FORBIDDEN", "Maliyet fiyatı güncelleme yetkiniz yok.", 403);
  }

  const data = parsed.data;
  const isService = isServiceProductType(existing.productType);
  const sku = normalizeOptionalText(data.sku);
  const hasBarcodeField =
    !isService && Object.prototype.hasOwnProperty.call(input.body, "barcode");
  const barcode = hasBarcodeField
    ? normalizeOptionalText(data.barcode ?? null)
    : isService
      ? null
      : existing.barcode;

  const uniqueCheck = await assertUniqueProductIdentifiers(input.companyId, {
    sku,
    barcode,
    excludeProductId: input.productId,
  });
  if (!uniqueCheck.ok) {
    throw new MobileCatalogError(
      uniqueCheck.field === "barcode" ? "PRODUCT_BARCODE_EXISTS" : "PRODUCT_SKU_EXISTS",
      uniqueCheck.message,
      uniqueCheck.field === "barcode" ? 409 : 400
    );
  }

  const categoryId = await resolveProductCategoryId(input.companyId, data.categoryName);

  await db.product.updateMany({
    where: { id: input.productId, companyId: input.companyId },
    data: {
      categoryId,
      name: data.name,
      sku,
      ...(hasBarcodeField ? { barcode } : {}),
      description: normalizeOptionalText(data.description),
      imageUrl: normalizeImageUrl(data.imageUrl),
      minStock: isService ? 0 : data.minStock,
      unitType: data.unitType,
      warehouseLocation: isService ? null : normalizeOptionalText(data.warehouseLocation),
      buyPrice: permissions.products.viewCostPrice ? data.buyPrice : existing.buyPrice,
      sellPrice: data.sellPrice,
      vatRate: data.vatRate,
      status: data.status,
    },
  });

  return getMobileProductById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    productId: input.productId,
  });
}

export async function archiveMobileProduct(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  productId: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.products.update) {
    throw new MobileCatalogError("FORBIDDEN", "Ürün güncelleme yetkiniz yok.", 403);
  }

  const existing = await db.product.findFirst({
    where: { id: input.productId, companyId: input.companyId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new MobileCatalogError("PRODUCT_NOT_FOUND", "Ürün bulunamadı.", 404);
  }

  if (existing.status === "ACTIVE") {
    await toggleProductStatus(input.companyId, input.productId, input.userId);
  } else {
    await db.product.updateMany({
      where: { id: input.productId, companyId: input.companyId },
      data: { status: "ACTIVE" },
    });
  }

  return getMobileProductById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    productId: input.productId,
  });
}

export async function getMobileProductStockMovements(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  productId: string;
  cursor?: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.stocks.read) {
    throw new MobileCatalogError("FORBIDDEN", "Stok görüntüleme yetkiniz yok.", 403);
  }

  const product = await db.product.findFirst({
    where: { id: input.productId, companyId: input.companyId },
    select: { id: true },
  });
  if (!product) {
    throw new MobileCatalogError("PRODUCT_NOT_FOUND", "Ürün bulunamadı.", 404);
  }

  const movements = await db.stockMovement.findMany({
    where: { companyId: input.companyId, productId: input.productId },
    orderBy: { createdAt: "desc" },
    take: 31,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      quantity: true,
      note: true,
      createdAt: true,
      warehouse: { select: { id: true, name: true } },
    },
  });

  const hasMore = movements.length > 30;
  const page = hasMore ? movements.slice(0, 30) : movements;

  return {
    items: page.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
      warehouseId: m.warehouse?.id ?? null,
      warehouseName: m.warehouse?.name ?? null,
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

export async function deleteMobileProduct(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  productId: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.products.delete) {
    throw new MobileCatalogError("FORBIDDEN", "Ürün silme yetkiniz yok.", 403);
  }

  const result = await deleteProduct(input.companyId, input.productId, input.userId);
  if (!result.ok) {
    throw new MobileCatalogError("VALIDATION_ERROR", result.message, 400);
  }
  return { deleted: true };
}
