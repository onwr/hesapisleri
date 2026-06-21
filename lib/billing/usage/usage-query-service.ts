import "server-only";

import { db } from "@/lib/prisma";
import { LIMIT_CODES } from "@/lib/billing/entitlements/entitlement-registry";

export type CompanyUsageSummary = {
  MAX_USERS: number;
  MAX_WAREHOUSES: number;
  MAX_PRODUCTS: number;
  MAX_MARKETPLACES: number;
  MAX_EMPLOYEES: number;
  MAX_COMPANIES?: number;
  MONTHLY_E_DOCUMENTS: number;
  MONTHLY_OCR_SCANS: number;
  MONTHLY_EXPORTS: number;
  MONTHLY_API_REQUESTS: number;
  MONTHLY_AUTOMATIONS: number;
  STORAGE_MB: number;
};

const METERED_CODES = [
  "MONTHLY_E_DOCUMENTS",
  "MONTHLY_OCR_SCANS",
  "MONTHLY_EXPORTS",
  "MONTHLY_API_REQUESTS",
  "MONTHLY_AUTOMATIONS",
] as const;

function monthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

async function getMeteredUsage(companyId: string, now = new Date()) {
  const { start } = monthBounds(now);
  const periods = await db.usagePeriod.findMany({
    where: {
      companyId,
      entitlementCode: { in: [...METERED_CODES] },
      periodStart: start,
    },
    select: { entitlementCode: true, used: true, reserved: true },
  });

  const map = new Map<string, number>();
  for (const code of METERED_CODES) map.set(code, 0);
  for (const period of periods) {
    map.set(period.entitlementCode, period.used + period.reserved);
  }
  return map;
}

export async function getCompanyUsageSummary(
  companyId: string,
  options?: { userId?: string; now?: Date }
): Promise<CompanyUsageSummary> {
  const now = options?.now ?? new Date();

  const [
    users,
    warehouses,
    products,
    marketplaceIntegrations,
    employees,
    metered,
    companiesForUser,
  ] = await Promise.all([
    db.companyUser.count({
      where: { companyId, status: { in: ["ACTIVE", "INVITED"] } },
    }),
    db.warehouse.count({ where: { companyId } }),
    db.product.count({ where: { companyId } }),
    db.marketplaceIntegration.count({ where: { companyId } }),
    db.employee.count({ where: { companyId } }),
    getMeteredUsage(companyId, now),
    options?.userId
      ? db.companyUser.count({
          where: { userId: options.userId, status: "ACTIVE" },
        })
      : Promise.resolve(0),
  ]);

  return {
    MAX_USERS: users,
    MAX_WAREHOUSES: warehouses,
    MAX_PRODUCTS: products,
    MAX_MARKETPLACES: marketplaceIntegrations,
    MAX_EMPLOYEES: employees,
    MAX_COMPANIES: companiesForUser || undefined,
    MONTHLY_E_DOCUMENTS: metered.get("MONTHLY_E_DOCUMENTS") ?? 0,
    MONTHLY_OCR_SCANS: metered.get("MONTHLY_OCR_SCANS") ?? 0,
    MONTHLY_EXPORTS: metered.get("MONTHLY_EXPORTS") ?? 0,
    MONTHLY_API_REQUESTS: metered.get("MONTHLY_API_REQUESTS") ?? 0,
    MONTHLY_AUTOMATIONS: metered.get("MONTHLY_AUTOMATIONS") ?? 0,
    STORAGE_MB: 0,
  };
}

export async function getCompaniesUsageSummary(
  companyIds: string[]
): Promise<Map<string, CompanyUsageSummary>> {
  if (companyIds.length === 0) return new Map();

  const uniqueIds = [...new Set(companyIds)];
  const now = new Date();
  const { start } = monthBounds(now);

  const [userCounts, warehouseCounts, productCounts, marketplaceCounts, employeeCounts, periods] =
    await Promise.all([
      db.companyUser.groupBy({
        by: ["companyId"],
        where: { companyId: { in: uniqueIds }, status: { in: ["ACTIVE", "INVITED"] } },
        _count: { _all: true },
      }),
      db.warehouse.groupBy({
        by: ["companyId"],
        where: { companyId: { in: uniqueIds } },
        _count: { _all: true },
      }),
      db.product.groupBy({
        by: ["companyId"],
        where: { companyId: { in: uniqueIds } },
        _count: { _all: true },
      }),
      db.marketplaceIntegration.groupBy({
        by: ["companyId"],
        where: { companyId: { in: uniqueIds } },
        _count: { _all: true },
      }),
      db.employee.groupBy({
        by: ["companyId"],
        where: { companyId: { in: uniqueIds } },
        _count: { _all: true },
      }),
      db.usagePeriod.findMany({
        where: {
          companyId: { in: uniqueIds },
          entitlementCode: { in: [...METERED_CODES] },
          periodStart: start,
        },
        select: { companyId: true, entitlementCode: true, used: true, reserved: true },
      }),
    ]);

  const toMap = <T extends { companyId: string; _count: { _all: number } }>(rows: T[]) => {
    const m = new Map<string, number>();
    for (const row of rows) m.set(row.companyId, row._count._all);
    return m;
  };

  const users = toMap(userCounts);
  const warehouses = toMap(warehouseCounts);
  const products = toMap(productCounts);
  const marketplaces = toMap(marketplaceCounts);
  const employees = toMap(employeeCounts);

  const meteredByCompany = new Map<string, Map<string, number>>();
  for (const id of uniqueIds) {
    const m = new Map<string, number>();
    for (const code of METERED_CODES) m.set(code, 0);
    meteredByCompany.set(id, m);
  }
  for (const period of periods) {
    const m = meteredByCompany.get(period.companyId);
    if (m) m.set(period.entitlementCode, period.used + period.reserved);
  }

  const result = new Map<string, CompanyUsageSummary>();
  for (const companyId of uniqueIds) {
    const metered = meteredByCompany.get(companyId)!;
    result.set(companyId, {
      MAX_USERS: users.get(companyId) ?? 0,
      MAX_WAREHOUSES: warehouses.get(companyId) ?? 0,
      MAX_PRODUCTS: products.get(companyId) ?? 0,
      MAX_MARKETPLACES: marketplaces.get(companyId) ?? 0,
      MAX_EMPLOYEES: employees.get(companyId) ?? 0,
      MONTHLY_E_DOCUMENTS: metered.get("MONTHLY_E_DOCUMENTS") ?? 0,
      MONTHLY_OCR_SCANS: metered.get("MONTHLY_OCR_SCANS") ?? 0,
      MONTHLY_EXPORTS: metered.get("MONTHLY_EXPORTS") ?? 0,
      MONTHLY_API_REQUESTS: metered.get("MONTHLY_API_REQUESTS") ?? 0,
      MONTHLY_AUTOMATIONS: metered.get("MONTHLY_AUTOMATIONS") ?? 0,
      STORAGE_MB: 0,
    });
  }

  return result;
}

export function getUsageForLimitCode(summary: CompanyUsageSummary, code: string): number {
  if (code in summary) {
    return summary[code as keyof CompanyUsageSummary] as number;
  }
  return 0;
}

export function isCountableLimitCode(code: string) {
  return LIMIT_CODES.includes(code);
}
