import { db } from "@/lib/prisma";
import { deleteProduct } from "@/lib/product-service";
import { validateProductPriceValue } from "@/lib/product-price-validation";

export const BULK_PRICE_NEGATIVE_BATCH_ERROR =
  "Toplu fiyat güncellemesi bazı ürünlerin fiyatını 0'ın altına düşürüyor.";

export type BulkPriceAdjustInput = {
  priceField: "sell" | "buy" | "both";
  direction: "increase" | "decrease";
  mode: "percent" | "fixed";
  value: number;
};

export type BulkPriceFieldTarget = "sellPrice" | "buyPrice";

export type BulkPriceProductSnapshot = {
  id: string;
  name: string;
  sku: string | null;
  buyPrice: number;
  sellPrice: number;
};

export type BulkPriceAdjustmentPreviewItem = {
  productId: string;
  productName: string;
  sku: string | null;
  field: BulkPriceFieldTarget;
  currentPrice: number;
  newPrice: number;
};

export type BulkPriceAdjustmentPlan = {
  updates: Array<{
    productId: string;
    buyPrice?: number;
    sellPrice?: number;
  }>;
  preview: BulkPriceAdjustmentPreviewItem[];
  violations: BulkPriceAdjustmentPreviewItem[];
  validChangeCount: number;
  negativeResultCount: number;
  lowestNewPrice: number | null;
};

export function roundBulkProductPrice(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateAdjustedPrice(
  current: number,
  input: BulkPriceAdjustInput
) {
  const { direction, mode, value } = input;
  const sign = direction === "increase" ? 1 : -1;

  if (mode === "percent") {
    return roundBulkProductPrice(current * (1 + (sign * value) / 100));
  }

  return roundBulkProductPrice(current + sign * value);
}

export function resolveBulkPriceFields(
  priceField: BulkPriceAdjustInput["priceField"]
): BulkPriceFieldTarget[] {
  if (priceField === "sell") return ["sellPrice"];
  if (priceField === "buy") return ["buyPrice"];
  return ["sellPrice", "buyPrice"];
}

export function buildBulkPriceAdjustmentPlan(
  products: BulkPriceProductSnapshot[],
  input: BulkPriceAdjustInput
): BulkPriceAdjustmentPlan {
  const fields = resolveBulkPriceFields(input.priceField);
  const preview: BulkPriceAdjustmentPreviewItem[] = [];
  const violations: BulkPriceAdjustmentPreviewItem[] = [];
  const updates: BulkPriceAdjustmentPlan["updates"] = [];

  for (const product of products) {
    const update: { productId: string; buyPrice?: number; sellPrice?: number } = {
      productId: product.id,
    };

    for (const field of fields) {
      const currentPrice =
        field === "sellPrice" ? product.sellPrice : product.buyPrice;
      const newPrice = calculateAdjustedPrice(currentPrice, input);
      const item: BulkPriceAdjustmentPreviewItem = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        field,
        currentPrice,
        newPrice,
      };
      preview.push(item);

      const validated = validateProductPriceValue(newPrice);
      if (!validated.ok) {
        violations.push(item);
      } else if (field === "sellPrice") {
        update.sellPrice = newPrice;
      } else {
        update.buyPrice = newPrice;
      }
    }

    updates.push(update);
  }

  const validNewPrices = preview
    .filter((item) => validateProductPriceValue(item.newPrice).ok)
    .map((item) => item.newPrice);
  const negativeProductIds = new Set(violations.map((item) => item.productId));

  return {
    updates,
    preview,
    violations,
    validChangeCount: preview.length - violations.length,
    negativeResultCount: negativeProductIds.size,
    lowestNewPrice: validNewPrices.length ? Math.min(...validNewPrices) : null,
  };
}

export async function bulkSetProductStatus(
  companyId: string,
  userId: string,
  productIds: string[],
  status: "ACTIVE" | "PASSIVE"
) {
  const products = await db.product.findMany({
    where: { companyId, id: { in: productIds } },
    select: { id: true, name: true, status: true },
  });

  let updated = 0;

  for (const product of products) {
    if (product.status === status) continue;

    await db.product.update({
      where: { id: product.id },
      data: { status },
    });
    updated += 1;
  }

  if (updated > 0) {
    await db.activityLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        module: "products",
        message: `${updated} ürün ${status === "ACTIVE" ? "aktifleştirildi" : "pasife alındı"}.`,
      },
    });
  }

  return {
    ok: true as const,
    updated,
    skipped: productIds.length - updated,
    message: `${updated} ürün güncellendi.`,
  };
}

export async function bulkAdjustProductPrices(
  companyId: string,
  userId: string,
  productIds: string[],
  input: BulkPriceAdjustInput
) {
  if (!productIds.length) {
    return {
      ok: false as const,
      status: 400,
      code: "EMPTY_SELECTION" as const,
      message: "Güncellenecek ürün seçilmedi.",
    };
  }

  const products = await db.product.findMany({
    where: { companyId, id: { in: productIds } },
    select: {
      id: true,
      name: true,
      sku: true,
      buyPrice: true,
      sellPrice: true,
    },
  });

  const foundIds = new Set(products.map((product) => product.id));
  const missingIds = productIds.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    return {
      ok: false as const,
      status: 400,
      code: "TENANT_SCOPE_MISMATCH" as const,
      message: "Seçili ürünlerden bazıları bulunamadı veya bu firmaya ait değil.",
      missingProductIds: missingIds,
    };
  }

  const snapshots: BulkPriceProductSnapshot[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    buyPrice: Number(product.buyPrice),
    sellPrice: Number(product.sellPrice),
  }));

  const plan = buildBulkPriceAdjustmentPlan(snapshots, input);

  if (plan.violations.length > 0) {
    return {
      ok: false as const,
      status: 400,
      code: "NEGATIVE_PRICE_RESULT" as const,
      message: BULK_PRICE_NEGATIVE_BATCH_ERROR,
      affectedProductCount: plan.negativeResultCount,
      violations: plan.violations.slice(0, 5),
      lowestNewPrice: plan.lowestNewPrice,
    };
  }

  await db.$transaction(async (tx) => {
    for (const update of plan.updates) {
      const data: { buyPrice?: number; sellPrice?: number } = {};
      if (update.buyPrice !== undefined) data.buyPrice = update.buyPrice;
      if (update.sellPrice !== undefined) data.sellPrice = update.sellPrice;

      await tx.product.update({
        where: { id: update.productId },
        data,
      });
    }

    await tx.activityLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        module: "products",
        message: `${plan.updates.length} ürün fiyatı toplu güncellendi.`,
      },
    });
  });

  return {
    ok: true as const,
    updated: plan.updates.length,
    message: `${plan.updates.length} ürünün fiyatı güncellendi.`,
  };
}

export async function bulkDeleteProducts(
  companyId: string,
  userId: string,
  productIds: string[]
) {
  const results: Array<{
    productId: string;
    ok: boolean;
    message: string;
    code?: string;
    saleItemCount?: number;
    transferCount?: number;
  }> = [];

  for (const productId of productIds) {
    const result = await deleteProduct(companyId, productId, userId);

    if (result.ok) {
      results.push({ productId, ok: true, message: result.message });
    } else {
      results.push({
        productId,
        ok: false,
        message: result.message,
        code: result.code,
        saleItemCount: result.saleItemCount,
        transferCount: result.transferCount,
      });
    }
  }

  const deleted = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  return {
    ok: true as const,
    deleted,
    failed,
    message:
      failed.length === 0
        ? `${deleted} ürün silindi.`
        : `${deleted} ürün silindi, ${failed.length} ürün silinemedi.`,
  };
}

export async function setProductStatus(
  companyId: string,
  userId: string,
  productId: string,
  status: "ACTIVE" | "PASSIVE"
) {
  const product = await db.product.findFirst({
    where: { id: productId, companyId },
    select: { id: true, status: true },
  });

  if (!product) {
    return { ok: false as const, status: 404, message: "Ürün bulunamadı." };
  }

  if (product.status === status) {
    return {
      ok: true as const,
      message: status === "ACTIVE" ? "Ürün zaten aktif." : "Ürün zaten pasif.",
    };
  }

  await db.product.update({
    where: { id: productId },
    data: { status },
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId,
      action: "UPDATE",
      module: "products",
      message: `Ürün ${status === "ACTIVE" ? "aktifleştirildi" : "pasife alındı"}.`,
    },
  });

  return {
    ok: true as const,
    message: status === "ACTIVE" ? "Ürün aktifleştirildi." : "Ürün pasife alındı.",
  };
}
