import { db } from "@/lib/prisma";
import { getPlatformRuntimeUploadLimits } from "@/lib/platform-runtime";
import {
  customerFormSchema,
  normalizeCustomerInput,
} from "@/lib/customer-form-utils";
import { getCustomerDetailLedgerData } from "@/lib/customer-detail-data";
import { getBalanceStatus } from "@/lib/customers-page-utils";
import { toIsoString } from "@/lib/format-utils";
import { MobileCatalogError } from "./mobile-catalog-errors";
import { resolveMobileCatalogPermissions } from "./mobile-catalog-permissions";

const PAGE_SIZE = 24;

export async function listMobileCustomers(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  q?: string;
  status?: string;
  balanceFilter?: "debtors" | "receivables";
  cursor?: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.customers.read) {
    throw new MobileCatalogError("FORBIDDEN", "Müşteri görüntüleme yetkiniz yok.", 403);
  }

  const q = input.q?.trim() ?? "";
  const where = {
    companyId: input.companyId,
    ...(input.status ? { status: input.status as "ACTIVE" | "PASSIVE" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
            { taxNo: { contains: q } },
          ],
        }
      : {}),
  };

  const customers = await db.customer.findMany({
    where,
    orderBy: { name: "asc" },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      taxNo: true,
      status: true,
      balance: true,
      group: true,
      updatedAt: true,
    },
  });

  let items = customers.map((c) => ({
    id: c.id,
    displayName: c.name,
    phone: c.phone,
    email: c.email,
    taxNumber: c.taxNo,
    status: c.status,
    customerType: c.group,
    lastTransactionAt: c.updatedAt.toISOString(),
    ...(permissions.customers.viewBalance ? { balance: Number(c.balance) } : {}),
  }));

  if (permissions.customers.viewDebtFilters && input.balanceFilter === "debtors") {
    items = items.filter((c) => (c.balance ?? 0) > 0);
  }
  if (permissions.customers.viewDebtFilters && input.balanceFilter === "receivables") {
    items = items.filter((c) => (c.balance ?? 0) < 0);
  }

  const hasMore = items.length > PAGE_SIZE;
  if (hasMore) items = items.slice(0, PAGE_SIZE);

  return {
    permissions,
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getMobileCustomerById(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  customerId: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.customers.read) {
    throw new MobileCatalogError("FORBIDDEN", "Müşteri görüntüleme yetkiniz yok.", 403);
  }

  const customer = await db.customer.findFirst({
    where: { id: input.customerId, companyId: input.companyId },
  });

  if (!customer) {
    throw new MobileCatalogError("CUSTOMER_NOT_FOUND", "Müşteri bulunamadı.", 404);
  }

  const ledger = await getCustomerDetailLedgerData(input.companyId, input.customerId);
  const balance = Number(customer.balance);

  return {
    permissions,
    customer: {
      id: customer.id,
      displayName: customer.name,
      phone: customer.phone,
      email: customer.email,
      taxNumber: customer.taxNo,
      taxOffice: customer.taxOffice,
      address: customer.address,
      status: customer.status,
      customerType: customer.group,
      note: null,
      ...(permissions.customers.viewBalance
        ? {
            balance,
            balanceStatus: getBalanceStatus(balance),
            accountSummary: {
              currentBalance: ledger.summary.currentBalance,
              totalDebt: ledger.summary.totalDebt,
              totalCollected: ledger.summary.totalCollected,
              lastCollectionDate: toIsoString(ledger.summary.lastCollectionDate),
            },
            recentSales: ledger.recentSales.map((s) => ({
              id: s.id,
              saleNumber: s.saleNo,
              total: s.total,
              paymentStatus: s.paymentStatus,
              createdAt: toIsoString(s.createdAt) ?? new Date(0).toISOString(),
            })),
            recentInvoices: ledger.recentInvoices.map((i) => ({
              id: i.id,
              invoiceNumber: i.invoiceNo,
              total: i.total,
              paymentStatus: i.paymentStatus,
              createdAt: toIsoString(i.createdAt) ?? new Date(0).toISOString(),
            })),
            recentCollections: ledger.ledger
              .filter((e) => e.type === "COLLECTION")
              .slice(0, 5)
              .map((e) => ({
                id: e.id,
                label: e.label,
                reference: e.reference,
                amount: e.credit,
                createdAt:
                  toIsoString(e.occurredAt ?? e.date) ?? new Date(0).toISOString(),
              })),
            openSales: ledger.openSales.map((s) => ({
              id: s.id,
              saleNumber: s.saleNo,
              total: s.total,
              paidAmount: s.paidAmount,
              remainingAmount: s.remainingAmount,
              paymentStatus: s.paymentStatus,
            })),
          }
        : {}),
    },
  };
}

export async function createMobileCustomer(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.customers.create) {
    throw new MobileCatalogError("FORBIDDEN", "Müşteri oluşturma yetkiniz yok.", 403);
  }

  const parsed = customerFormSchema.safeParse(input.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    throw new MobileCatalogError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      fieldErrors as Record<string, string[]>
    );
  }

  const uploadLimits = await getPlatformRuntimeUploadLimits();
  let normalized;
  try {
    normalized = normalizeCustomerInput(parsed.data, {
      maxTaxCertificateBytes: uploadLimits.maxTaxCertificateBytes,
    });
  } catch (error) {
    throw new MobileCatalogError(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Geçersiz müşteri bilgisi.",
      400
    );
  }

  const duplicate = await db.customer.findFirst({
    where: {
      companyId: input.companyId,
      OR: [
        ...(normalized.phone ? [{ phone: normalized.phone }] : []),
        ...(normalized.email ? [{ email: normalized.email }] : []),
      ],
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new MobileCatalogError(
      "CUSTOMER_DUPLICATE",
      "Bu telefon veya e-posta ile kayıtlı müşteri zaten var.",
      409
    );
  }

  const customer = await db.customer.create({
    data: {
      companyId: input.companyId,
      ...normalized,
      balance: 0,
      status: "ACTIVE",
    },
  });

  return getMobileCustomerById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    customerId: customer.id,
  });
}

export async function updateMobileCustomer(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  customerId: string;
  body: unknown;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.customers.update) {
    throw new MobileCatalogError("FORBIDDEN", "Müşteri güncelleme yetkiniz yok.", 403);
  }

  const existing = await db.customer.findFirst({
    where: { id: input.customerId, companyId: input.companyId },
  });
  if (!existing) {
    throw new MobileCatalogError("CUSTOMER_NOT_FOUND", "Müşteri bulunamadı.", 404);
  }

  const parsed = customerFormSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileCatalogError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  const uploadLimits = await getPlatformRuntimeUploadLimits();
  const normalized = normalizeCustomerInput(parsed.data, {
    maxTaxCertificateBytes: uploadLimits.maxTaxCertificateBytes,
  });

  await db.customer.updateMany({
    where: { id: input.customerId, companyId: input.companyId },
    data: normalized,
  });

  return getMobileCustomerById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    customerId: input.customerId,
  });
}

export async function archiveMobileCustomer(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  customerId: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.customers.update) {
    throw new MobileCatalogError("FORBIDDEN", "Müşteri güncelleme yetkiniz yok.", 403);
  }

  const existing = await db.customer.findFirst({
    where: { id: input.customerId, companyId: input.companyId },
    select: { status: true },
  });
  if (!existing) {
    throw new MobileCatalogError("CUSTOMER_NOT_FOUND", "Müşteri bulunamadı.", 404);
  }

  await db.customer.updateMany({
    where: { id: input.customerId, companyId: input.companyId },
    data: { status: existing.status === "ACTIVE" ? "PASSIVE" : "ACTIVE" },
  });

  return getMobileCustomerById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    customerId: input.customerId,
  });
}
