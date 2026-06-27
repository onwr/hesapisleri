import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";
import {
  getSupplierDisplayName,
  matchesSupplierSearch,
  normalizeSupplierTags,
  parseSupplierBalanceStatus,
  parseSupplierSort,
  supplierFormSchema,
  type SupplierFormInput,
  type SupplierRow,
  type SupplierSortOption,
} from "@/lib/supplier-utils";

export class SupplierServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SupplierServiceError";
    this.status = status;
  }
}

function serializeSupplier(
  supplier: Prisma.SupplierGetPayload<{ include: { _count: { select: { supplierProducts: true } } } }>,
  metrics: {
    lastActivityAt?: Date | null;
    lastActivityType?: string | null;
    overdueAmount?: number;
    overdueCount?: number;
  } = {}
): SupplierRow {
  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    companyName: supplier.companyName,
    contactName: supplier.contactName,
    phone: supplier.phone,
    mobilePhone: supplier.mobilePhone,
    email: supplier.email,
    taxNumber: supplier.taxNumber,
    category: supplier.category,
    city: supplier.city,
    district: supplier.district,
    currentBalance: roundCashMoney(Number(supplier.currentBalance)),
    overdueAmount: roundCashMoney(metrics.overdueAmount ?? 0),
    overdueCount: metrics.overdueCount ?? 0,
    productCount: supplier._count.supplierProducts,
    currency: supplier.currency,
    isActive: supplier.isActive,
    isFavorite: supplier.isFavorite,
    updatedAt: supplier.updatedAt,
    lastActivityAt: metrics.lastActivityAt ?? null,
    lastActivityType: metrics.lastActivityType ?? null,
  };
}

function resolveSupplierName(input: SupplierFormInput) {
  const name = input.name?.trim();
  const companyName = input.companyName?.trim();
  return {
    name: name || companyName || "",
    companyName: companyName || null,
  };
}

export async function findDuplicateSupplierCode(
  companyId: string,
  code: string | null | undefined,
  excludeId?: string
) {
  const normalized = code?.trim();
  if (!normalized) return null;

  return db.supplier.findFirst({
    where: {
      companyId,
      code: normalized,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

export async function findDuplicateSupplierTaxNumber(
  companyId: string,
  taxNumber: string | null | undefined,
  excludeId?: string
) {
  const normalized = taxNumber?.trim();
  if (!normalized) return null;

  return db.supplier.findFirst({
    where: {
      companyId,
      taxNumber: normalized,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

export async function createSupplier(input: {
  companyId: string;
  userId: string;
  data: unknown;
}) {
  const parsed = supplierFormSchema.safeParse(input.data);
  if (!parsed.success) {
    throw new SupplierServiceError("Bilgileri kontrol edin.", 400);
  }

  const form = parsed.data;
  const names = resolveSupplierName(form);
  if (!names.name) {
    throw new SupplierServiceError("Tedarikçi adı veya firma adı zorunludur.", 400);
  }

  if (form.code?.trim()) {
    const duplicateCode = await findDuplicateSupplierCode(input.companyId, form.code);
    if (duplicateCode) {
      throw new SupplierServiceError("Bu kodda bir tedarikçi zaten var.", 409);
    }
  }

  const duplicateTax = await findDuplicateSupplierTaxNumber(
    input.companyId,
    form.taxNumber
  );

  const supplier = await db.supplier.create({
    data: {
      companyId: input.companyId,
      createdByUserId: input.userId,
      code: form.code?.trim() || null,
      name: names.name,
      companyName: names.companyName,
      contactName: form.contactName?.trim() || null,
      phone: form.phone?.trim() || null,
      mobilePhone: form.mobilePhone?.trim() || null,
      email: form.email?.trim() || null,
      website: form.website?.trim() || null,
      taxOffice: form.taxOffice?.trim() || null,
      taxNumber: form.taxNumber?.trim() || null,
      iban: form.iban?.trim() || null,
      address: form.address?.trim() || null,
      city: form.city?.trim() || null,
      district: form.district?.trim() || null,
      country: form.country?.trim() || "Türkiye",
      category: form.category?.trim() || null,
      tags: normalizeSupplierTags(form.tags),
      notes: form.notes?.trim() || null,
      openingBalance: roundCashMoney(form.openingBalance ?? 0),
      currency: form.currency?.trim() || "TRY",
      paymentTermDays: form.paymentTermDays ?? null,
      isFavorite: form.isFavorite ?? false,
      isActive: form.isActive ?? true,
    },
  });

  await syncSupplierBalance(input.companyId, supplier.id);

  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: "CREATE",
      module: "suppliers",
      message: `${getSupplierDisplayName(supplier)} tedarikçisi oluşturuldu.`,
    },
  });

  const refreshed = await db.supplier.findUniqueOrThrow({ where: { id: supplier.id } });

  return {
    supplier: refreshed,
    taxNumberWarning: duplicateTax
      ? "Bu vergi numarası başka bir tedarikçide de kayıtlı."
      : null,
  };
}

export async function updateSupplier(input: {
  companyId: string;
  userId: string;
  supplierId: string;
  data: unknown;
}) {
  const existing = await db.supplier.findFirst({
    where: { id: input.supplierId, companyId: input.companyId },
  });

  if (!existing) {
    throw new SupplierServiceError("Tedarikçi bulunamadı.", 404);
  }

  const parsed = supplierFormSchema.safeParse(input.data);
  if (!parsed.success) {
    throw new SupplierServiceError("Bilgileri kontrol edin.", 400);
  }

  const form = parsed.data;
  const names = resolveSupplierName({
    name: form.name ?? existing.name,
    companyName: form.companyName ?? existing.companyName ?? undefined,
  });

  if (form.code?.trim()) {
    const duplicateCode = await findDuplicateSupplierCode(
      input.companyId,
      form.code,
      input.supplierId
    );
    if (duplicateCode) {
      throw new SupplierServiceError("Bu kodda bir tedarikçi zaten var.", 409);
    }
  }

  const duplicateTax = await findDuplicateSupplierTaxNumber(
    input.companyId,
    form.taxNumber ?? existing.taxNumber,
    input.supplierId
  );

  const supplier = await db.supplier.update({
    where: { id: input.supplierId },
    data: {
      ...(form.code !== undefined ? { code: form.code?.trim() || null } : {}),
      ...(form.name !== undefined || form.companyName !== undefined
        ? { name: names.name, companyName: names.companyName }
        : {}),
      ...(form.contactName !== undefined
        ? { contactName: form.contactName?.trim() || null }
        : {}),
      ...(form.phone !== undefined ? { phone: form.phone?.trim() || null } : {}),
      ...(form.mobilePhone !== undefined
        ? { mobilePhone: form.mobilePhone?.trim() || null }
        : {}),
      ...(form.email !== undefined ? { email: form.email?.trim() || null } : {}),
      ...(form.website !== undefined ? { website: form.website?.trim() || null } : {}),
      ...(form.taxOffice !== undefined
        ? { taxOffice: form.taxOffice?.trim() || null }
        : {}),
      ...(form.taxNumber !== undefined
        ? { taxNumber: form.taxNumber?.trim() || null }
        : {}),
      ...(form.iban !== undefined ? { iban: form.iban?.trim() || null } : {}),
      ...(form.address !== undefined ? { address: form.address?.trim() || null } : {}),
      ...(form.city !== undefined ? { city: form.city?.trim() || null } : {}),
      ...(form.district !== undefined ? { district: form.district?.trim() || null } : {}),
      ...(form.country !== undefined
        ? { country: form.country?.trim() || "Türkiye" }
        : {}),
      ...(form.category !== undefined ? { category: form.category?.trim() || null } : {}),
      ...(form.tags !== undefined ? { tags: normalizeSupplierTags(form.tags) } : {}),
      ...(form.notes !== undefined ? { notes: form.notes?.trim() || null } : {}),
      ...(form.openingBalance !== undefined
        ? { openingBalance: roundCashMoney(form.openingBalance) }
        : {}),
      ...(form.currency !== undefined
        ? { currency: form.currency?.trim() || "TRY" }
        : {}),
      ...(form.paymentTermDays !== undefined
        ? { paymentTermDays: form.paymentTermDays }
        : {}),
      ...(form.isFavorite !== undefined ? { isFavorite: form.isFavorite } : {}),
      ...(form.isActive !== undefined ? { isActive: form.isActive } : {}),
    },
  });

  await syncSupplierBalance(input.companyId, supplier.id);

  return {
    supplier,
    taxNumberWarning: duplicateTax
      ? "Bu vergi numarası başka bir tedarikçide de kayıtlı."
      : null,
  };
}

export async function deactivateSupplier(companyId: string, supplierId: string) {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, companyId },
  });

  if (!supplier) {
    throw new SupplierServiceError("Tedarikçi bulunamadı.", 404);
  }

  return db.supplier.update({
    where: { id: supplierId },
    data: { isActive: false },
  });
}

export async function deleteSupplier(input: {
  companyId: string;
  userId: string;
  supplierId: string;
}) {
  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, companyId: input.companyId },
    select: { id: true, name: true, currentBalance: true },
  });

  if (!supplier) {
    throw new SupplierServiceError("Tedarikçi bulunamadı.", 404);
  }

  const balance = roundCashMoney(Number(supplier.currentBalance));
  if (balance !== 0) {
    throw new SupplierServiceError(
      "Açık bakiyesi olan tedarikçi silinemez. Önce borç durumunu kapatın veya tedarikçiyi pasife alın.",
      400
    );
  }

  const [expenseCount, stockMovementCount] = await Promise.all([
    db.expense.count({
      where: { companyId: input.companyId, supplierId: input.supplierId },
    }),
    db.stockMovement.count({
      where: { companyId: input.companyId, supplierId: input.supplierId },
    }),
  ]);

  if (expenseCount > 0) {
    throw new SupplierServiceError(
      "Gider kaydı olan tedarikçi silinemez. Kaydı pasife alabilirsiniz.",
      400
    );
  }

  if (stockMovementCount > 0) {
    throw new SupplierServiceError(
      "Stok hareketi olan tedarikçi silinemez. Kaydı pasife alabilirsiniz.",
      400
    );
  }

  await db.$transaction(async (tx) => {
    const deleted = await tx.supplier.deleteMany({
      where: { id: input.supplierId, companyId: input.companyId },
    });

    if (deleted.count === 0) {
      throw new SupplierServiceError("Tedarikçi bulunamadı.", 404);
    }

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "DELETE",
        module: "suppliers",
        message: `${supplier.name} tedarikçisi silindi.`,
      },
    });
  });
}

export async function toggleSupplierFavorite(companyId: string, supplierId: string) {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, companyId },
  });

  if (!supplier) {
    throw new SupplierServiceError("Tedarikçi bulunamadı.", 404);
  }

  return db.supplier.update({
    where: { id: supplierId },
    data: { isFavorite: !supplier.isFavorite },
  });
}

export async function getSupplierById(companyId: string, supplierId: string) {
  return db.supplier.findFirst({
    where: { id: supplierId, companyId },
    include: {
      contacts: { where: { isActive: true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      supplierProducts: {
        include: {
          product: { select: { id: true, name: true, sku: true, buyPrice: true } },
        },
        orderBy: [{ isPreferred: "desc" }, { updatedAt: "desc" }],
      },
    },
  });
}

export type GetSuppliersOptions = {
  companyId: string;
  search?: string | null;
  category?: string | null;
  city?: string | null;
  isActive?: boolean | null;
  isFavorite?: boolean | null;
  hasProducts?: boolean | null;
  balanceStatus?: ReturnType<typeof parseSupplierBalanceStatus>;
  sort?: SupplierSortOption;
};

export async function getSuppliers(options: GetSuppliersOptions) {
  const suppliers = await db.supplier.findMany({
    where: {
      companyId: options.companyId,
      ...(options.category ? { category: options.category } : {}),
      ...(options.city ? { city: options.city } : {}),
      ...(options.isActive !== null && options.isActive !== undefined
        ? { isActive: options.isActive }
        : {}),
      ...(options.isFavorite ? { isFavorite: true } : {}),
    },
    include: {
      _count: { select: { supplierProducts: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const [expenseDates, stockDates, unpaidExpenses] = await Promise.all([
    db.expense.groupBy({
      by: ["supplierId"],
      where: {
        companyId: options.companyId,
        supplierId: { not: null },
      },
      _max: { date: true },
    }),
    db.stockMovement.groupBy({
      by: ["supplierId"],
      where: {
        companyId: options.companyId,
        supplierId: { not: null },
      },
      _max: { createdAt: true },
    }),
    db.expense.findMany({
      where: {
        companyId: options.companyId,
        supplierId: { not: null },
        paymentStatus: "UNPAID",
        status: { not: "CANCELLED" },
      },
      select: {
        supplierId: true,
        amount: true,
        date: true,
        supplierRef: { select: { paymentTermDays: true } },
      },
    }),
  ]);

  const lastActivityMap = new Map<string, { at: Date; type: string }>();
  for (const item of expenseDates) {
    if (item.supplierId && item._max.date) {
      lastActivityMap.set(item.supplierId, { at: item._max.date, type: "Gider" });
    }
  }
  for (const item of stockDates) {
    if (!item.supplierId || !item._max.createdAt) continue;
    const current = lastActivityMap.get(item.supplierId);
    if (!current || item._max.createdAt > current.at) {
      lastActivityMap.set(item.supplierId, {
        at: item._max.createdAt,
        type: "Stok Girişi",
      });
    }
  }

  const overdueMap = new Map<string, { amount: number; count: number }>();
  for (const expense of unpaidExpenses) {
    if (!expense.supplierId) continue;
    const dueDate = new Date(expense.date);
    dueDate.setDate(
      dueDate.getDate() + (expense.supplierRef?.paymentTermDays ?? 0)
    );
    if (dueDate >= now) continue;
    const current = overdueMap.get(expense.supplierId) ?? { amount: 0, count: 0 };
    current.amount = roundCashMoney(current.amount + Number(expense.amount));
    current.count += 1;
    overdueMap.set(expense.supplierId, current);
  }

  let rows = suppliers.map((supplier) => {
    const lastActivity = lastActivityMap.get(supplier.id);
    const overdue = overdueMap.get(supplier.id);
    return serializeSupplier(supplier, {
      lastActivityAt: lastActivity?.at ?? null,
      lastActivityType: lastActivity?.type ?? null,
      overdueAmount: overdue?.amount ?? 0,
      overdueCount: overdue?.count ?? 0,
    });
  });

  rows = rows.filter((row) => matchesSupplierSearch(row, options.search));

  if (options.hasProducts === true) {
    rows = rows.filter((row) => row.productCount > 0);
  } else if (options.hasProducts === false) {
    rows = rows.filter((row) => row.productCount === 0);
  }

  const balanceStatus = options.balanceStatus ?? "all";
  if (balanceStatus === "payable") {
    rows = rows.filter((row) => row.currentBalance > 0);
  } else if (balanceStatus === "receivable") {
    rows = rows.filter((row) => row.currentBalance < 0);
  } else if (balanceStatus === "clear") {
    rows = rows.filter((row) => row.currentBalance === 0);
  } else if (balanceStatus === "overdue") {
    rows = rows.filter((row) => row.overdueAmount > 0);
  }

  const sort = options.sort ?? "recent";
  rows.sort((left, right) => {
    switch (sort) {
      case "name":
        return getSupplierDisplayName(left).localeCompare(
          getSupplierDisplayName(right),
          "tr"
        );
      case "balance_desc":
        return right.currentBalance - left.currentBalance;
      case "balance_asc":
        return left.currentBalance - right.currentBalance;
      case "last_activity":
        return (
          (right.lastActivityAt?.getTime() ?? 0) -
          (left.lastActivityAt?.getTime() ?? 0)
        );
      case "product_count":
        return right.productCount - left.productCount;
      default:
        return right.updatedAt.getTime() - left.updatedAt.getTime();
    }
  });

  return rows;
}

export async function getSupplierOptions(companyId: string) {
  const suppliers = await db.supplier.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      companyName: true,
      code: true,
      taxNumber: true,
    },
  });

  return suppliers.map((supplier) => ({
    id: supplier.id,
    label: getSupplierDisplayName(supplier),
    code: supplier.code,
    taxNumber: supplier.taxNumber,
  }));
}
