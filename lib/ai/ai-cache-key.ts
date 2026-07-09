import { createHash } from "node:crypto";
import { db } from "@/lib/prisma";
import { FINANCIAL_METRIC_VERSION } from "@/lib/finance/financial-summary-service";

export const AI_PROMPT_VERSION = "1.2.0";

export async function getCompanyDataRevisionHash(companyId: string) {
  const [sales, invoices, products, accounts, expenses] = await Promise.all([
    db.sale.aggregate({
      where: { companyId },
      _max: { updatedAt: true },
      _count: true,
    }),
    db.invoice.aggregate({
      where: { companyId },
      _max: { updatedAt: true },
      _count: true,
    }),
    db.product.aggregate({
      where: { companyId },
      _max: { updatedAt: true },
      _count: true,
    }),
    db.account.aggregate({
      where: { companyId },
      _max: { updatedAt: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: { companyId },
      _max: { updatedAt: true },
      _count: true,
    }),
  ]);

  const payload = {
    metricVersion: FINANCIAL_METRIC_VERSION,
    sales: [sales._count, sales._max.updatedAt?.toISOString() || null],
    invoices: [invoices._count, invoices._max.updatedAt?.toISOString() || null],
    products: [products._count, products._max.updatedAt?.toISOString() || null],
    accounts: [accounts._count, accounts._max.updatedAt?.toISOString() || null],
    expenses: [expenses._count, expenses._max.updatedAt?.toISOString() || null],
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export async function buildInsightCacheKey(input: {
  companyId: string;
  scope: string;
  from?: Date;
  to?: Date;
  model?: string | null;
}) {
  const revision = await getCompanyDataRevisionHash(input.companyId);
  const fromKey = input.from ? input.from.toISOString().slice(0, 10) : "auto";
  const toKey = input.to ? input.to.toISOString().slice(0, 10) : "auto";
  const modelKey = input.model || "default";

  return [
    input.scope,
    input.companyId,
    fromKey,
    toKey,
    revision,
    modelKey,
    AI_PROMPT_VERSION,
    FINANCIAL_METRIC_VERSION,
  ].join(":");
}
