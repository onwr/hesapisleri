import type { Prisma, SaleStatus, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { getUnpaidInvoiceForSale } from "@/lib/collections-service";
import { cancelSaleById } from "@/lib/sale-cancel-service";
import {
  derivePaymentStatus,
  getSaleRemainingAmount,
  recordSaleCollection,
  roundMoney,
} from "@/lib/sale-payment-utils";
import { applyCustomerCollection } from "@/lib/customer-balance-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { MobilePosError } from "./mobile-pos-errors";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type MobileSalesListFilters = {
  search?: string;
  status?: string;
  paymentStatus?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest";
};

const SALE_STATUSES: SaleStatus[] = ["DRAFT", "COMPLETED", "CANCELLED", "REFUNDED"];
const PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "UNPAID", "PARTIAL", "FAILED"];

function parseDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function listMobileSales(
  companyId: string,
  filters: MobileSalesListFilters
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

  const where: Prisma.SaleWhereInput = { companyId };

  if (filters.status && (SALE_STATUSES as string[]).includes(filters.status)) {
    where.status = filters.status as SaleStatus;
  }

  if (
    filters.paymentStatus &&
    (PAYMENT_STATUSES as string[]).includes(filters.paymentStatus)
  ) {
    where.paymentStatus = filters.paymentStatus as PaymentStatus;
  }

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  const dateFrom = parseDate(filters.dateFrom);
  const dateTo = parseDate(filters.dateTo);
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { saleNo: { contains: search, mode: "insensitive" } },
      { note: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { phone: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.SaleOrderByWithRelationInput = {
    createdAt: filters.sort === "oldest" ? "asc" : "desc",
  };

  const [total, rows, summaryAgg] = await Promise.all([
    db.sale.count({ where }),
    db.sale.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        invoice: { select: { id: true } },
        _count: { select: { items: true } },
      },
    }),
    db.sale.aggregate({
      where,
      _sum: { total: true, paidAmount: true },
    }),
  ]);

  // Vadesi geçen tutar — bağlı fatura vade tarihi geçmiş ve ödenmemiş satışlar
  const overdueAgg = await db.sale.aggregate({
    where: {
      ...where,
      status: { notIn: ["CANCELLED", "REFUNDED"] },
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      invoice: { dueDate: { lt: new Date() } },
    },
    _sum: { total: true, paidAmount: true },
  });

  const totalSalesMinor = Math.round(Number(summaryAgg._sum.total ?? 0) * 100);
  const collectedMinor = Math.round(Number(summaryAgg._sum.paidAmount ?? 0) * 100);
  const overdueTotal = Number(overdueAgg._sum.total ?? 0);
  const overduePaid = Number(overdueAgg._sum.paidAmount ?? 0);

  const items = rows.map((sale) => {
    const totalAmount = Number(sale.total);
    const paidAmount = Number(sale.paidAmount);
    return {
      id: sale.id,
      saleNumber: sale.saleNo,
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      customer: sale.customer ? { id: sale.customer.id, name: sale.customer.name } : null,
      itemCount: sale._count.items,
      totalAmountMinor: Math.round(totalAmount * 100),
      paidAmountMinor: Math.round(paidAmount * 100),
      remainingAmountMinor: Math.round(
        getSaleRemainingAmount(totalAmount, paidAmount) * 100
      ),
      currency: "TRY" as const,
      createdAt: sale.createdAt.toISOString(),
      dueDate: null as string | null,
      invoiceId: sale.invoice?.id ?? null,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
    summary: {
      totalSalesMinor,
      collectedMinor,
      remainingMinor: Math.max(0, totalSalesMinor - collectedMinor),
      overdueMinor: Math.max(
        0,
        Math.round((overdueTotal - overduePaid) * 100)
      ),
    },
  };
}

export async function collectMobileSalePayment(input: {
  companyId: string;
  userId: string;
  saleId: string;
  amount: number;
  accountId: string;
  paidAt?: string;
  note?: string;
}) {
  const sale = await db.sale.findFirst({
    where: { id: input.saleId, companyId: input.companyId },
    include: { invoice: true },
  });

  if (!sale) {
    throw new MobilePosError("NOT_FOUND", "Satış bulunamadı.", 404);
  }

  if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
    throw new MobilePosError(
      "SALE_CANCELLED",
      "İptal edilmiş satıştan tahsilat alınamaz.",
      400
    );
  }

  const unpaidInvoice = await getUnpaidInvoiceForSale(input.companyId, sale.id);
  if (unpaidInvoice) {
    throw new MobilePosError(
      "COLLECT_VIA_INVOICE",
      "Bu satış için fatura oluşturulmuş. Tahsilatı fatura üzerinden alın.",
      400
    );
  }

  const total = Number(sale.total);
  const currentPaid = Number(sale.paidAmount);
  const remaining = getSaleRemainingAmount(total, currentPaid);

  const collectAmount = roundMoney(input.amount);
  if (!(collectAmount > 0)) {
    throw new MobilePosError("INVALID_AMOUNT", "Geçerli bir tahsilat tutarı girin.", 400);
  }
  if (collectAmount > remaining) {
    throw new MobilePosError(
      "AMOUNT_EXCEEDS_REMAINING",
      "Kalan tutardan fazla tahsilat yapılamaz.",
      400
    );
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    throw new MobilePosError("INVALID_DATE", "Geçerli bir tahsilat tarihi girin.", 400);
  }

  const nextPaidAmount = roundMoney(currentPaid + collectAmount);
  const cappedPaidAmount = roundMoney(Math.min(total, nextPaidAmount));
  const nextPaymentStatus = derivePaymentStatus(total, cappedPaidAmount);

  const updated = await db.$transaction(async (tx) => {
    await recordSaleCollection(tx, {
      companyId: input.companyId,
      saleNo: sale.saleNo,
      amount: collectAmount,
      accountId: input.accountId,
      collectedAt: paidAt,
      note: input.note?.trim() || undefined,
    });

    await applyCustomerCollection(tx, input.companyId, sale.customerId, collectAmount);

    const result = await tx.sale.update({
      where: { id: sale.id },
      data: { paidAmount: cappedPaidAmount, paymentStatus: nextPaymentStatus },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "sales",
        message: `${sale.saleNo} numaralı satıştan ${collectAmount.toFixed(2)} TL tahsil edildi (mobil).`,
      },
    });

    await createNotification(
      {
        companyId: input.companyId,
        userId: input.userId,
        type: nextPaymentStatus === "PAID" ? "SUCCESS" : "INFO",
        category: "FINANCE",
        module: "sales",
        entityType: "SALE",
        entityId: sale.id,
        actionUrl: `/sales/${sale.id}`,
        title:
          nextPaymentStatus === "PAID" ? "Satış tahsilatı tamamlandı" : "Kısmi tahsilat alındı",
        message: `${sale.saleNo} için ${collectAmount.toFixed(2)} TL tahsil edildi.`,
      },
      tx
    );

    return result;
  });

  invalidateDashboardCache(input.companyId, "sale-collect");

  const updatedTotal = Number(updated.total);
  const updatedPaid = Number(updated.paidAmount);

  return {
    id: updated.id,
    status: updated.status,
    paymentStatus: updated.paymentStatus,
    totalAmountMinor: Math.round(updatedTotal * 100),
    paidAmountMinor: Math.round(updatedPaid * 100),
    remainingAmountMinor: Math.round(
      getInvoiceRemainingAmount(updatedTotal, updatedPaid) * 100
    ),
  };
}

export async function cancelMobileSale(input: {
  companyId: string;
  userId: string;
  saleId: string;
  reason: string;
  note?: string;
}) {
  const result = await cancelSaleById(input.saleId, input.companyId, input.userId, {
    reason: input.reason,
    note: input.note,
  });

  if (!result.ok) {
    throw new MobilePosError(
      result.status === 404 ? "NOT_FOUND" : "CANCEL_NOT_ALLOWED",
      result.message,
      result.status
    );
  }

  invalidateDashboardCache(input.companyId, "sale-cancel");

  return { message: result.message };
}
