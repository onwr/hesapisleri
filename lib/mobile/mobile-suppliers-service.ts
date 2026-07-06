import { z } from "zod";
import { db } from "@/lib/prisma";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  SupplierServiceError,
} from "@/lib/supplier-service";
import { getSupplierDetailLedgerData } from "@/lib/supplier-detail-ledger-data";
import { getSupplierProductsForSupplier } from "@/lib/supplier-product-service";
import {
  createSupplierPayment,
  SupplierFinanceError,
} from "@/lib/supplier-finance-service";
import { canManageSuppliers } from "@/lib/permission-utils";
import { parseSupplierBalanceStatus, parseSupplierSort } from "@/lib/supplier-utils";
import type { UserRole } from "@prisma/client";
import { MobileFinanceError } from "./mobile-finance-errors";
import { resolveMobileFinancePermissions } from "./mobile-finance-permissions";

const PAGE_SIZE = 24;
const LEDGER_PAGE_SIZE = 20;
const RECENT_LIMIT = 5;

function toMinor(amount: number) {
  return Math.round(amount * 100);
}

function supplierWriteAllowed(role: string, isOwner: boolean) {
  // Tedarikçi oluşturma/düzenleme ve ödeme — web'deki requireApiSupplierManage()
  // ile BİREBİR aynı kural: yalnız OWNER/ADMIN (canManageSuppliers).
  return canManageSuppliers(role as UserRole, isOwner);
}

/**
 * Picker modu — expense formundaki tedarikçi seçici tarafından kullanılır.
 * Geriye dönük uyumluluk için DEĞİŞTİRİLMEDİ (cursor pagination, minimal alan seti).
 */
export async function listMobileSuppliers(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  q?: string;
  cursor?: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.suppliers.read) {
    throw new MobileFinanceError("FORBIDDEN", "Tedarikçi görüntüleme yetkiniz yok.", 403);
  }

  const suppliers = await getSuppliers({
    companyId: input.companyId,
    search: input.q,
    isActive: true,
    sort: "name",
  });

  const start = input.cursor ? suppliers.findIndex((s) => s.id === input.cursor) + 1 : 0;
  const slice = suppliers.slice(start, start + PAGE_SIZE + 1);
  const hasMore = slice.length > PAGE_SIZE;
  const page = hasMore ? slice.slice(0, PAGE_SIZE) : slice;

  return {
    permissions,
    items: page.map((s) => ({
      id: s.id,
      name: s.name || s.companyName || "Tedarikçi",
      phone: s.phone,
      ...(permissions.suppliers.viewBalance
        ? { balanceMinor: toMinor(s.currentBalance) }
        : {}),
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

export type MobileSuppliersListFullFilters = {
  search?: string;
  balanceStatus?: string;
  favorite?: boolean;
  hasDebt?: boolean;
  hasProducts?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
};

/**
 * Tam liste modu — mobil Tedarikçiler ekranı için. Filtreleme/sıralama/bakiye
 * hesaplaması tamamen canonical getSuppliers() üzerinden yapılır; burada yalnız
 * sayfalama, minor-amount dönüşümü ve DTO şekillendirmesi yapılır.
 */
export async function listMobileSuppliersFull(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  filters: MobileSuppliersListFullFilters;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.suppliers.read) {
    throw new MobileFinanceError("FORBIDDEN", "Tedarikçi görüntüleme yetkiniz yok.", 403);
  }

  const { filters } = input;
  // hasDebt spec alanı balanceStatus="payable" ile eşleniyor (aynı canonical filtreyi
  // farklı isimle sunuyor — ayrı/çelişkili bir bakiye hesaplaması icat edilmedi).
  const balanceStatus = filters.hasDebt
    ? "payable"
    : parseSupplierBalanceStatus(filters.balanceStatus);

  const allRows = await getSuppliers({
    companyId: input.companyId,
    search: filters.search,
    isActive: true,
    isFavorite: filters.favorite === true ? true : undefined,
    hasProducts: filters.hasProducts,
    balanceStatus,
    sort: parseSupplierSort(filters.sort),
  });

  // Filtreyle tutarlı özet — sayfalamadan ÖNCEKİ tam (filtrelenmiş) veri üzerinden.
  let totalPayableMinor = 0;
  let totalReceivableMinor = 0;
  let payableSupplierCount = 0;
  let receivableSupplierCount = 0;
  let balancedSupplierCount = 0;
  for (const row of allRows) {
    if (row.payableAmount > 0) {
      totalPayableMinor += toMinor(row.payableAmount);
      payableSupplierCount += 1;
    } else if (row.receivableAmount > 0) {
      totalReceivableMinor += toMinor(row.receivableAmount);
      receivableSupplierCount += 1;
    } else {
      balancedSupplierCount += 1;
    }
  }

  const expenseCounts = await db.expense.groupBy({
    by: ["supplierId"],
    where: { companyId: input.companyId, supplierId: { not: null } },
    _count: { _all: true },
  });
  const expenseCountMap = new Map(
    expenseCounts.filter((e) => e.supplierId).map((e) => [e.supplierId as string, e._count._all])
  );

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? PAGE_SIZE));
  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = allRows.slice(start, start + pageSize);

  return {
    permissions,
    items: pageRows.map((row) => ({
      id: row.id,
      name: row.name || row.companyName || "Tedarikçi",
      contactName: row.contactName,
      phone: row.phone,
      email: row.email,
      city: row.city,
      isFavorite: row.isFavorite,
      ...(permissions.suppliers.viewBalance
        ? {
            balanceMinor: toMinor(row.currentBalance),
            balanceDirection:
              row.payableAmount > 0 ? "PAYABLE" : row.receivableAmount > 0 ? "RECEIVABLE" : "SETTLED",
            balanceLabel: row.netStatusLabel,
          }
        : {}),
      productCount: row.productCount,
      expenseCount: expenseCountMap.get(row.id) ?? 0,
      lastTransactionAt: row.lastActivityAt ? row.lastActivityAt.toISOString() : null,
      permissions: {
        canPay: permissions.suppliers.viewBalance && supplierWriteAllowed(input.role, input.isOwner),
      },
    })),
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    summary: {
      totalSuppliers: total,
      payableSupplierCount,
      receivableSupplierCount,
      balancedSupplierCount,
      totalPayableMinor,
      totalReceivableMinor,
    },
  };
}

export async function getMobileSupplierDetail(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  supplierId: string;
  page?: number;
  pageSize?: number;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.suppliers.read) {
    throw new MobileFinanceError("FORBIDDEN", "Tedarikçi görüntüleme yetkiniz yok.", 403);
  }

  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, companyId: input.companyId },
    select: { id: true, name: true, companyName: true, phone: true, email: true, currency: true },
  });
  if (!supplier) {
    throw new MobileFinanceError("SUPPLIER_NOT_FOUND", "Tedarikçi bulunamadı.", 404);
  }

  // Tek canonical bakiye/defter kaynağı — running balance TÜM geçmiş üzerinden
  // burada hesaplanır; sayfalama bu hesaplamadan SONRA, hazır diziden dilimlenir
  // (kısmi veriden yeniden hesaplama yapılmaz, running balance bozulmaz).
  const detail = await getSupplierDetailLedgerData(input.companyId, input.supplierId);
  if (!detail) {
    throw new MobileFinanceError("SUPPLIER_NOT_FOUND", "Tedarikçi bulunamadı.", 404);
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? LEDGER_PAGE_SIZE));

  // En yeni hareket üstte — kronolojik running balance dizisini ters çevirip dilimliyoruz.
  const chronological = detail.ledger;
  const newestFirst = [...chronological].reverse();
  const total = newestFirst.length;
  const start = (page - 1) * pageSize;
  const ledgerPage = newestFirst.slice(start, start + pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const canPay = permissions.suppliers.viewBalance && supplierWriteAllowed(input.role, input.isOwner);

  // Yalnız mevcut Expense.supplierId / StockMovement.supplierId ilişkileri —
  // yeni finans/stok mantığı icat edilmedi.
  const [productCount, stockMovementCount, paymentCount, expenseCount, recentExpenses, recentStockMovements] =
    await Promise.all([
      db.supplierProduct.count({ where: { companyId: input.companyId, supplierId: input.supplierId } }),
      db.stockMovement.count({ where: { companyId: input.companyId, supplierId: input.supplierId } }),
      db.supplierLedgerEntry.count({
        where: { companyId: input.companyId, supplierId: input.supplierId, type: "PAYMENT" },
      }),
      db.expense.count({ where: { companyId: input.companyId, supplierId: input.supplierId } }),
      db.expense.findMany({
        where: { companyId: input.companyId, supplierId: input.supplierId },
        orderBy: { date: "desc" },
        take: RECENT_LIMIT,
        select: { id: true, title: true, amount: true, status: true, date: true },
      }),
      db.stockMovement.findMany({
        where: { companyId: input.companyId, supplierId: input.supplierId },
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
        select: {
          id: true,
          productId: true,
          type: true,
          quantity: true,
          note: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      }),
    ]);

  return {
    id: supplier.id,
    name: supplier.name || supplier.companyName || "Tedarikçi",
    phone: supplier.phone,
    email: supplier.email,
    currency: supplier.currency,
    summary: {
      signedBalanceMinor: toMinor(detail.summary.signedBalance),
      direction: detail.summary.direction,
      directionLabel: detail.summary.directionLabel,
      payableAmountMinor: toMinor(detail.summary.payableAmount),
      receivableAmountMinor: toMinor(detail.summary.receivableAmount),
      overduePayableMinor: toMinor(detail.summary.overduePayable),
      totalPurchasesMinor: toMinor(detail.summary.totalPurchases),
      lastMovementDate: detail.summary.lastMovementDate,
    },
    stats: {
      productCount,
      expenseCount,
      stockMovementCount,
      paymentCount,
      lastTransactionAt: detail.summary.lastMovementDate,
    },
    recentExpenses: recentExpenses.map((e) => ({
      id: e.id,
      title: e.title,
      amountMinor: toMinor(Number(e.amount)),
      status: e.status,
      occurredAt: e.date.toISOString(),
      referenceNumber: null as string | null,
    })),
    recentStockMovements: recentStockMovements.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product?.name ?? null,
      type: m.type,
      quantity: m.quantity,
      description: m.note,
      occurredAt: m.createdAt.toISOString(),
    })),
    ledger: {
      items: ledgerPage.map((row) => ({
        id: row.id,
        date: row.date,
        type: row.type,
        typeLabel: row.typeLabel,
        description: row.description,
        debitMinor: toMinor(row.debit),
        creditMinor: toMinor(row.credit),
        balanceMinor: toMinor(row.balance),
        balanceDirection: row.balanceDirection,
        accountName: row.accountName,
        relatedEntityHref: row.relatedEntityHref,
      })),
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
    linkedCustomer: detail.linkedCustomer
      ? { id: detail.linkedCustomer.id, name: detail.linkedCustomer.name }
      : null,
    permissions: {
      canViewBalance: permissions.suppliers.viewBalance,
      canPay,
      canEdit: supplierWriteAllowed(input.role, input.isOwner),
    },
  };
}

const PRODUCTS_PAGE_SIZE = 30;

/**
 * Tedarikçiye bağlı ürünler — canonical getSupplierProductsForSupplier() reuse.
 * lastPurchaseAt yalnız mevcut StockMovement (type IN + supplierId) kayıtlarından
 * türetilir; yeni bir "satın alma" kavramı icat edilmedi.
 */
export async function getMobileSupplierProducts(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  supplierId: string;
  page?: number;
  pageSize?: number;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.suppliers.read) {
    throw new MobileFinanceError("FORBIDDEN", "Tedarikçi görüntüleme yetkiniz yok.", 403);
  }

  const supplier = await db.supplier.findFirst({
    where: { id: input.supplierId, companyId: input.companyId },
    select: { id: true },
  });
  if (!supplier) {
    throw new MobileFinanceError("SUPPLIER_NOT_FOUND", "Tedarikçi bulunamadı.", 404);
  }

  const rows = await getSupplierProductsForSupplier(input.companyId, input.supplierId);

  const productIds = rows.map((r) => r.productId);
  const lastPurchaseRows = productIds.length
    ? await db.stockMovement.groupBy({
        by: ["productId"],
        where: {
          companyId: input.companyId,
          supplierId: input.supplierId,
          productId: { in: productIds },
          type: "IN",
        },
        _max: { createdAt: true },
      })
    : [];
  const lastPurchaseMap = new Map(
    lastPurchaseRows.map((r) => [r.productId, r._max.createdAt?.toISOString() ?? null])
  );

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? PRODUCTS_PAGE_SIZE));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    items: pageRows.map((r) => ({
      id: r.id,
      productId: r.productId,
      variantId: null as string | null,
      productName: r.product.name,
      variantName: null as string | null,
      sku: r.product.sku,
      barcode: r.product.barcode,
      supplierSku: r.supplierSku,
      purchasePriceMinor: r.purchasePrice != null ? toMinor(Number(r.purchasePrice)) : null,
      currency: r.currency,
      isPreferred: r.isPreferred,
      lastPurchaseAt: lastPurchaseMap.get(r.productId) ?? null,
      productImageUrl: r.product.imageUrl,
    })),
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

export const mobileSupplierPaymentSchema = z.object({
  accountId: z.string().min(1, "Hesap seçilmelidir."),
  amount: z.number().positive("Tutar sıfırdan büyük olmalıdır."),
  date: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid("Geçerli idempotency anahtarı gerekir."),
});

export async function payMobileSupplier(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  supplierId: string;
  body: unknown;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.suppliers.viewBalance || !supplierWriteAllowed(input.role, input.isOwner)) {
    throw new MobileFinanceError("FORBIDDEN", "Tedarikçi ödemesi yapma yetkiniz yok.", 403);
  }

  const parsed = mobileSupplierPaymentSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  // accountId tenant scope'u createSupplierPayment içindeki
  // validateSupplierFinanceAccount tarafından da doğrulanır — burada erken
  // 404 için ayrıca kontrol ediyoruz (net hata mesajı).
  const account = await db.account.findFirst({
    where: { id: parsed.data.accountId, companyId: input.companyId },
  });
  if (!account) {
    throw new MobileFinanceError("FINANCE_ACCOUNT_NOT_FOUND", "Ödeme hesabı bulunamadı.", 404);
  }

  try {
    const result = await createSupplierPayment({
      companyId: input.companyId,
      supplierId: input.supplierId,
      userId: input.userId,
      accountId: parsed.data.accountId,
      amount: parsed.data.amount,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      description: parsed.data.description,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return {
      replay: result.replay,
      overpaymentNotice: result.overpaymentNotice,
      amountMinor: toMinor(parsed.data.amount),
    };
  } catch (error) {
    if (error instanceof SupplierFinanceError) {
      throw new MobileFinanceError("SUPPLIER_PAYMENT_FAILED", error.message, error.status);
    }
    throw error;
  }
}

export const mobileSupplierFormSchema = z.object({
  name: z.string().trim().min(1).optional(),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  taxNumber: z.string().trim().optional(),
  taxOffice: z.string().trim().optional(),
  city: z.string().trim().optional(),
  district: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  isFavorite: z.boolean().optional(),
});

/**
 * Tedarikçi oluşturma — web'in canonical createSupplier() servisini reuse eder.
 * Yeni/paralel bir tedarikçi doğrulama mantığı yazılmadı; supplierFormSchema
 * (lib/supplier-utils.ts) doğrudan createSupplier() içinde uygulanıyor.
 */
export async function createMobileSupplier(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  if (!supplierWriteAllowed(input.role, input.isOwner)) {
    throw new MobileFinanceError("FORBIDDEN", "Tedarikçi oluşturma yetkiniz yok.", 403);
  }

  const parsed = mobileSupplierFormSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  try {
    const result = await createSupplier({
      companyId: input.companyId,
      userId: input.userId,
      data: parsed.data,
    });
    return { id: result.supplier.id, name: result.supplier.name, replay: result.replay };
  } catch (error) {
    if (error instanceof SupplierServiceError) {
      throw new MobileFinanceError("SUPPLIER_CREATE_FAILED", error.message, error.status);
    }
    throw error;
  }
}

export async function updateMobileSupplier(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  supplierId: string;
  body: unknown;
}) {
  if (!supplierWriteAllowed(input.role, input.isOwner)) {
    throw new MobileFinanceError("FORBIDDEN", "Tedarikçi düzenleme yetkiniz yok.", 403);
  }

  const parsed = mobileSupplierFormSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  try {
    const result = await updateSupplier({
      companyId: input.companyId,
      userId: input.userId,
      supplierId: input.supplierId,
      data: parsed.data,
    });
    return { id: result.supplier.id, name: result.supplier.name };
  } catch (error) {
    if (error instanceof SupplierServiceError) {
      throw new MobileFinanceError("SUPPLIER_UPDATE_FAILED", error.message, error.status);
    }
    throw error;
  }
}
