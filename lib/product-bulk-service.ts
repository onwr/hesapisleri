import { db } from "@/lib/prisma";
import { deleteProduct, toggleProductStatus } from "@/lib/product-service";

export type BulkPriceAdjustInput = {
  priceField: "sell" | "buy" | "both";
  direction: "increase" | "decrease";
  mode: "percent" | "fixed";
  value: number;
};

export function calculateAdjustedPrice(
  current: number,
  input: BulkPriceAdjustInput
) {
  const { direction, mode, value } = input;
  const sign = direction === "increase" ? 1 : -1;

  if (mode === "percent") {
    const next = current * (1 + (sign * value) / 100);
    return Math.max(0, Math.round(next * 100) / 100);
  }

  const next = current + sign * value;
  return Math.max(0, Math.round(next * 100) / 100);
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
  const products = await db.product.findMany({
    where: { companyId, id: { in: productIds } },
    select: { id: true, buyPrice: true, sellPrice: true },
  });

  let updated = 0;

  for (const product of products) {
    const data: { buyPrice?: number; sellPrice?: number } = {};

    if (input.priceField === "sell" || input.priceField === "both") {
      data.sellPrice = calculateAdjustedPrice(
        Number(product.sellPrice),
        input
      );
    }

    if (input.priceField === "buy" || input.priceField === "both") {
      data.buyPrice = calculateAdjustedPrice(Number(product.buyPrice), input);
    }

    await db.product.update({
      where: { id: product.id },
      data,
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
        message: `${updated} ürün fiyatı toplu güncellendi.`,
      },
    });
  }

  return {
    ok: true as const,
    updated,
    message: `${updated} ürünün fiyatı güncellendi.`,
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
