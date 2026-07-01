import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";
import {
  parseSupplierOpeningDirection,
  signedBalanceFromOpeningInput,
} from "@/lib/supplier-balance-utils";
import { createSupplierOpeningLedgerEntry } from "@/lib/supplier-finance-service";
import {
  getSupplierDisplayName,
  matchesSupplierSearch,
  normalizeSupplierTags,
  parseSupplierBalanceStatus,
  parseSupplierSort,
  resolveOpeningBalanceAmountInput,
  resolveOpeningBalanceDescription,
  supplierFormSchema,
  type SupplierFormInput,
  type SupplierRow,
  type SupplierSortOption,
} from "@/lib/supplier-utils";
import { resolveSupplierBalanceView } from "@/lib/supplier-balance-utils";
import {
  getExistingCreateSupplierId,
  recordCreateSupplierIdempotency,
} from "@/lib/supplier-create-idempotency";

export class SupplierServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SupplierServiceError";
    this.status = status;
  }
}

function serializeSupplier(
  supplier: Prisma.SupplierGetPayload<{ include: { _count: { select: { supplierProducts: true } } } }> & {
    linkedCustomerId?: string | null;
  },
  metrics: {
    lastActivityAt?: Date | null;
    lastActivityType?: string | null;
    overdueAmount?: number;
    overdueCount?: number;
    totalPurchases?: number;
  } = {}
): SupplierRow {
  const balanceView = resolveSupplierBalanceView(Number(supplier.currentBalance));
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
    currentBalance: balanceView.signedBalance,
    payableAmount: balanceView.payableAmount,
    receivableAmount: balanceView.receivableAmount,
    netStatusLabel: balanceView.netStatusLabel,
    totalPurchases: roundCashMoney(metrics.totalPurchases ?? 0),
    hasCustomerRole: Boolean(supplier.linkedCustomerId),
    linkedCustomerId: supplier.linkedCustomerId ?? null,
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

  if (form.clientRequestId) {
    const existingId = getExistingCreateSupplierId(input.companyId, form.clientRequestId);
    if (existingId) {
      const existing = await db.supplier.findFirst({
        where: { id: existingId, companyId: input.companyId },
      });
      if (existing) {
        return { supplier: existing, taxNumberWarning: null, replay: true as const };
      }
    }
  }

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

  const openingAmount = resolveOpeningBalanceAmountInput(form);
  const openingDirection = parseSupplierOpeningDirection(form.openingBalanceDirection);
  const openingSigned = signedBalanceFromOpeningInput({
    amount: openingAmount,
    direction: openingDirection,
  });

  if (!openingSigned.ok) {
    throw new SupplierServiceError(openingSigned.message, 400);
  }

  const openingDate = form.openingBalanceDate
    ? new Date(form.openingBalanceDate)
    : new Date();

  if (form.openingBalanceDate && Number.isNaN(openingDate.getTime())) {
    throw new SupplierServiceError("Geçerli bir açılış tarihi girin.", 400);
  }

  const supplier = await db.$transaction(async (tx) => {
    const created = await tx.supplier.create({
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
        openingBalance: openingSigned.signed,
        openingBalanceDate: openingSigned.signed !== 0 ? openingDate : null,
        openingBalanceNote: resolveOpeningBalanceDescription(form),
        currentBalance: openingSigned.signed,
        currency: form.currency?.trim() || "TRY",
        paymentTermDays: form.paymentTermDays ?? null,
        isFavorite: form.isFavorite ?? false,
        isActive: form.isActive ?? true,
      },
    });

    if (openingSigned.signed !== 0) {
      await createSupplierOpeningLedgerEntry({
        tx,
        companyId: input.companyId,
        supplierId: created.id,
        userId: input.userId,
        signedOpeningBalance: openingSigned.signed,
        date: openingDate,
        description: resolveOpeningBalanceDescription(form) || "Açılış bakiyesi",
      });
    }

    return created;
  });

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

  if (form.clientRequestId) {
    recordCreateSupplierIdempotency(input.companyId, form.clientRequestId, refreshed.id);
  }

  return {
    supplier: refreshed,
    taxNumberWarning: duplicateTax
      ? "Bu vergi numarası başka bir tedarikçide de kayıtlı."
      : null,
    replay: false as const,
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

  const openingLedgerExists = await db.supplierLedgerEntry.findFirst({
    where: {
      companyId: input.companyId,
      supplierId: input.supplierId,
      type: "OPENING_BALANCE",
    },
    select: { id: true },
  });

  let openingPatch: {
    openingBalance?: number;
    openingBalanceDate?: Date | null;
    openingBalanceNote?: string | null;
  } = {};

  if (
    !openingLedgerExists &&
    (form.openingBalance !== undefined || form.openingBalanceDirection !== undefined)
  ) {
    const openingAmount = roundCashMoney(form.openingBalance ?? Number(existing.openingBalance));
    const openingDirection = parseSupplierOpeningDirection(
      form.openingBalanceDirection ??
        (Number(existing.openingBalance) > 0
          ? "PAYABLE"
          : Number(existing.openingBalance) < 0
            ? "RECEIVABLE"
            : "SETTLED")
    );
    const openingSigned = signedBalanceFromOpeningInput({
      amount: Math.abs(openingAmount),
      direction: openingDirection,
    });
    if (!openingSigned.ok) {
      throw new SupplierServiceError(openingSigned.message, 400);
    }
    openingPatch = {
      openingBalance: openingSigned.signed,
      openingBalanceDate:
        openingSigned.signed !== 0
          ? form.openingBalanceDate
            ? new Date(form.openingBalanceDate)
            : existing.openingBalanceDate ?? new Date()
          : null,
      openingBalanceNote:
        form.openingBalanceNote !== undefined
          ? form.openingBalanceNote?.trim() || null
          : undefined,
    };
  }

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
      ...openingPatch,
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
  hasCustomerRole?: boolean | null;
  balanceStatus?: ReturnType<typeof parseSupplierBalanceStatus>;
  balanceDirection?: "all" | "PAYABLE" | "RECEIVABLE" | "SETTLED";
  lastActivityFrom?: Date | null;
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
  const [expenseDates, stockDates, ledgerDates, unpaidExpenses, purchaseTotals] =
    await Promise.all([
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
    db.supplierLedgerEntry.groupBy({
      by: ["supplierId"],
      where: { companyId: options.companyId },
      _max: { date: true },
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
    db.expense.groupBy({
      by: ["supplierId"],
      where: {
        companyId: options.companyId,
        supplierId: { not: null },
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
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

  for (const item of ledgerDates) {
    const current = lastActivityMap.get(item.supplierId);
    if (!current || item._max.date! > current.at) {
      lastActivityMap.set(item.supplierId, {
        at: item._max.date!,
        type: "Cari Hareket",
      });
    }
  }

  const purchaseMap = new Map(
    purchaseTotals
      .filter((item) => item.supplierId)
      .map((item) => [item.supplierId!, roundCashMoney(Number(item._sum.amount ?? 0))])
  );

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
      totalPurchases: purchaseMap.get(supplier.id) ?? 0,
    });
  });

  if (options.hasCustomerRole === true) {
    rows = rows.filter((row) => row.hasCustomerRole);
  } else if (options.hasCustomerRole === false) {
    rows = rows.filter((row) => !row.hasCustomerRole);
  }

  if (options.lastActivityFrom) {
    rows = rows.filter(
      (row) =>
        row.lastActivityAt != null && row.lastActivityAt >= options.lastActivityFrom!
    );
  }

  const balanceDirection = options.balanceDirection ?? "all";
  if (balanceDirection === "PAYABLE") {
    rows = rows.filter((row) => row.payableAmount > 0);
  } else if (balanceDirection === "RECEIVABLE") {
    rows = rows.filter((row) => row.receivableAmount > 0);
  } else if (balanceDirection === "SETTLED") {
    rows = rows.filter(
      (row) => row.payableAmount === 0 && row.receivableAmount === 0
    );
  }

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
