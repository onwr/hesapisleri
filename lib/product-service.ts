import { db } from "@/lib/prisma";
import { getActiveProductCategoryNames } from "@/lib/product-category-service";
import {
  generateProductBarcode,
  generateProductSku,
} from "@/lib/product-identifier-utils";
import {
  normalizeCategoryName,
  normalizeOptionalText,
} from "@/lib/product-form-utils";
import { getDefaultProductCategoryColor } from "@/lib/product-category-utils";

export async function resolveProductCategoryId(
  companyId: string,
  categoryName?: string | null
) {
  const name = normalizeCategoryName(categoryName);

  const existing = await db.productCategory.findFirst({
    where: {
      companyId,
      name,
    },
  });

  if (existing) {
    return existing.id;
  }

  const category = await db.productCategory.create({
    data: {
      companyId,
      name,
      color: getDefaultProductCategoryColor(name),
      status: "ACTIVE",
    },
  });

  return category.id;
}

export async function getProductCategoryNames(companyId: string) {
  return getActiveProductCategoryNames(companyId);
}

export async function assertUniqueProductIdentifiers(
  companyId: string,
  input: {
    sku?: string | null;
    barcode?: string | null;
    excludeProductId?: string;
  }
) {
  const sku = normalizeOptionalText(input.sku);
  const barcode = normalizeOptionalText(input.barcode);

  if (sku) {
    const existingSku = await db.product.findFirst({
      where: {
        companyId,
        sku,
        ...(input.excludeProductId
          ? { id: { not: input.excludeProductId } }
          : {}),
      },
      select: { id: true },
    });

    if (existingSku) {
      return {
        ok: false as const,
        field: "sku" as const,
        message: "Bu SKU bu firmada zaten kullanılıyor.",
      };
    }
  }

  if (barcode) {
    const existingBarcode = await db.product.findFirst({
      where: {
        companyId,
        barcode,
        ...(input.excludeProductId
          ? { id: { not: input.excludeProductId } }
          : {}),
      },
      select: { id: true },
    });

    if (existingBarcode) {
      return {
        ok: false as const,
        field: "barcode" as const,
        message: "Bu barkod bu firmada zaten kullanılıyor.",
      };
    }
  }

  return { ok: true as const };
}

export async function generateUniqueProductIdentifiers(companyId: string) {
  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const sku = generateProductSku();
    const barcode = generateProductBarcode();
    const uniqueCheck = await assertUniqueProductIdentifiers(companyId, {
      sku,
      barcode,
    });

    if (uniqueCheck.ok) {
      return { sku, barcode };
    }
  }

  throw new Error("Benzersiz SKU ve barkod üretilemedi.");
}

export async function deleteProduct(
  companyId: string,
  productId: string,
  userId: string
) {
  const product = await db.product.findFirst({
    where: { id: productId, companyId },
    select: { id: true, name: true, sku: true },
  });

  if (!product) {
    return {
      ok: false as const,
      status: 404,
      message: "Ürün bulunamadı.",
    };
  }

  const [saleItemCount, transferCount] = await Promise.all([
    db.saleItem.count({ where: { productId } }),
    db.warehouseTransfer.count({ where: { productId, companyId } }),
  ]);

  if (saleItemCount > 0) {
    return {
      ok: false as const,
      status: 400,
      code: "SALE_HISTORY" as const,
      saleItemCount,
      transferCount,
      message:
        "Bu ürün satış kayıtlarında kullanıldığı için silinemez.",
    };
  }

  if (transferCount > 0) {
    return {
      ok: false as const,
      status: 400,
      code: "TRANSFER_HISTORY" as const,
      saleItemCount,
      transferCount,
      message:
        "Bu ürün depo transfer geçmişi olduğu için silinemez.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.product.delete({ where: { id: productId } });

    await tx.activityLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        module: "products",
        message: `${product.name} (${product.sku ?? "SKU yok"}) ürünü silindi.`,
      },
    });
  });

  return {
    ok: true as const,
    message: "Ürün silindi.",
  };
}

export async function toggleProductStatus(
  companyId: string,
  productId: string,
  userId: string
) {
  const product = await db.product.findFirst({
    where: { id: productId, companyId },
    select: { id: true, name: true, status: true },
  });

  if (!product) {
    return {
      ok: false as const,
      status: 404,
      message: "Ürün bulunamadı.",
    };
  }

  const nextStatus = product.status === "ACTIVE" ? "PASSIVE" : "ACTIVE";

  const updated = await db.product.update({
    where: { id: productId },
    data: { status: nextStatus },
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId,
      action: "UPDATE",
      module: "products",
      message: `${product.name} ürünü ${nextStatus === "ACTIVE" ? "aktifleştirildi" : "pasife alındı"}.`,
    },
  });

  return {
    ok: true as const,
    data: updated,
    message:
      nextStatus === "ACTIVE"
        ? "Ürün aktifleştirildi."
        : "Ürün pasife alındı.",
  };
}
