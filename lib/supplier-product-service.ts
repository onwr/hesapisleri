import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { supplierProductSchema } from "@/lib/supplier-utils";

export class SupplierProductServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SupplierProductServiceError";
    this.status = status;
  }
}

export async function addProductToSupplier(input: {
  companyId: string;
  supplierId: string;
  data: unknown;
}) {
  const parsed = supplierProductSchema.safeParse(input.data);
  if (!parsed.success) {
    throw new SupplierProductServiceError("Bilgileri kontrol edin.", 400);
  }

  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, companyId: input.companyId, isActive: true },
  });
  if (!supplier) {
    throw new SupplierProductServiceError("Tedarikçi bulunamadı veya pasif.", 404);
  }

  const product = await db.product.findFirst({
    where: { id: parsed.data.productId, companyId: input.companyId },
  });
  if (!product) {
    throw new SupplierProductServiceError("Ürün bulunamadı.", 404);
  }

  const existing = await db.supplierProduct.findUnique({
    where: {
      companyId_supplierId_productId: {
        companyId: input.companyId,
        supplierId: input.supplierId,
        productId: parsed.data.productId,
      },
    },
  });
  if (existing) {
    throw new SupplierProductServiceError("Bu ürün zaten tedarikçiye bağlı.", 409);
  }

  if (parsed.data.isPreferred) {
    await db.supplierProduct.updateMany({
      where: { companyId: input.companyId, productId: parsed.data.productId },
      data: { isPreferred: false },
    });
  }

  return db.supplierProduct.create({
    data: {
      companyId: input.companyId,
      supplierId: input.supplierId,
      productId: parsed.data.productId,
      supplierSku: parsed.data.supplierSku?.trim() || null,
      supplierBarcode: parsed.data.supplierBarcode?.trim() || null,
      purchasePrice:
        parsed.data.purchasePrice !== undefined
          ? roundCashMoney(parsed.data.purchasePrice)
          : null,
      currency: parsed.data.currency?.trim() || "TRY",
      minOrderQuantity: parsed.data.minOrderQuantity ?? null,
      leadTimeDays: parsed.data.leadTimeDays ?? null,
      isPreferred: parsed.data.isPreferred ?? false,
      notes: parsed.data.notes?.trim() || null,
    },
    include: {
      product: { select: { id: true, name: true, sku: true, buyPrice: true } },
      supplier: { select: { id: true, name: true, companyName: true } },
    },
  });
}

export async function updateSupplierProduct(input: {
  companyId: string;
  supplierId: string;
  supplierProductId: string;
  data: unknown;
}) {
  const parsed = supplierProductSchema.partial().safeParse(input.data);
  if (!parsed.success) {
    throw new SupplierProductServiceError("Bilgileri kontrol edin.", 400);
  }

  const existing = await db.supplierProduct.findFirst({
    where: {
      id: input.supplierProductId,
      companyId: input.companyId,
      supplierId: input.supplierId,
    },
  });

  if (!existing) {
    throw new SupplierProductServiceError("Tedarikçi ürün kaydı bulunamadı.", 404);
  }

  if (parsed.data.isPreferred) {
    await db.supplierProduct.updateMany({
      where: { companyId: input.companyId, productId: existing.productId },
      data: { isPreferred: false },
    });
  }

  return db.supplierProduct.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.supplierSku !== undefined
        ? { supplierSku: parsed.data.supplierSku?.trim() || null }
        : {}),
      ...(parsed.data.supplierBarcode !== undefined
        ? { supplierBarcode: parsed.data.supplierBarcode?.trim() || null }
        : {}),
      ...(parsed.data.purchasePrice !== undefined
        ? { purchasePrice: roundCashMoney(parsed.data.purchasePrice) }
        : {}),
      ...(parsed.data.currency !== undefined
        ? { currency: parsed.data.currency?.trim() || "TRY" }
        : {}),
      ...(parsed.data.minOrderQuantity !== undefined
        ? { minOrderQuantity: parsed.data.minOrderQuantity }
        : {}),
      ...(parsed.data.leadTimeDays !== undefined
        ? { leadTimeDays: parsed.data.leadTimeDays }
        : {}),
      ...(parsed.data.isPreferred !== undefined
        ? { isPreferred: parsed.data.isPreferred }
        : {}),
      ...(parsed.data.notes !== undefined
        ? { notes: parsed.data.notes?.trim() || null }
        : {}),
    },
    include: {
      product: { select: { id: true, name: true, sku: true, buyPrice: true } },
      supplier: { select: { id: true, name: true, companyName: true } },
    },
  });
}

export async function removeSupplierProduct(input: {
  companyId: string;
  supplierId: string;
  supplierProductId: string;
}) {
  const existing = await db.supplierProduct.findFirst({
    where: {
      id: input.supplierProductId,
      companyId: input.companyId,
      supplierId: input.supplierId,
    },
  });

  if (!existing) {
    throw new SupplierProductServiceError("Tedarikçi ürün kaydı bulunamadı.", 404);
  }

  await db.supplierProduct.delete({ where: { id: existing.id } });
  return { id: existing.id };
}

export async function setPreferredSupplierForProduct(input: {
  companyId: string;
  productId: string;
  supplierProductId: string;
}) {
  const record = await db.supplierProduct.findFirst({
    where: {
      id: input.supplierProductId,
      companyId: input.companyId,
      productId: input.productId,
    },
  });

  if (!record) {
    throw new SupplierProductServiceError("Tedarikçi ürün kaydı bulunamadı.", 404);
  }

  await db.supplierProduct.updateMany({
    where: { companyId: input.companyId, productId: input.productId },
    data: { isPreferred: false },
  });

  return db.supplierProduct.update({
    where: { id: record.id },
    data: { isPreferred: true },
  });
}

export async function getSupplierProductsForSupplier(companyId: string, supplierId: string) {
  return db.supplierProduct.findMany({
    where: { companyId, supplierId },
    include: {
      product: { select: { id: true, name: true, sku: true, buyPrice: true, stock: true } },
    },
    orderBy: [{ isPreferred: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getSupplierProductsForProduct(companyId: string, productId: string) {
  return db.supplierProduct.findMany({
    where: { companyId, productId },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          companyName: true,
          phone: true,
          email: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ isPreferred: "desc" }, { updatedAt: "desc" }],
  });
}
