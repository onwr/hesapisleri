import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { calculateSupplierBalance, syncSupplierBalance } from "@/lib/supplier-balance-service";

export type SupplierReconciliationRow = {
  supplierId: string;
  supplierName: string;
  expectedBalance: number;
  currentBalance: number;
  delta: number;
};

export async function reconcileSupplierBalanceRow(
  companyId: string,
  supplierId: string
): Promise<SupplierReconciliationRow | null> {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, companyId },
    select: { id: true, name: true, companyName: true, currentBalance: true },
  });

  if (!supplier) return null;

  const expected = await calculateSupplierBalance(companyId, supplierId);
  if (expected === null) return null;

  const current = roundCashMoney(Number(supplier.currentBalance));
  const expectedRounded = roundCashMoney(expected);

  return {
    supplierId: supplier.id,
    supplierName: supplier.companyName?.trim() || supplier.name,
    expectedBalance: expectedRounded,
    currentBalance: current,
    delta: roundCashMoney(current - expectedRounded),
  };
}

export async function reconcileCompanySupplierBalances(companyId: string) {
  const suppliers = await db.supplier.findMany({
    where: { companyId },
    select: { id: true },
  });

  const rows: SupplierReconciliationRow[] = [];

  for (const supplier of suppliers) {
    const row = await reconcileSupplierBalanceRow(companyId, supplier.id);
    if (row) rows.push(row);
  }

  return rows;
}

export async function applySupplierBalanceReconciliation(
  companyId: string,
  supplierIds?: string[]
) {
  const suppliers = await db.supplier.findMany({
    where: {
      companyId,
      ...(supplierIds?.length ? { id: { in: supplierIds } } : {}),
    },
    select: { id: true },
  });

  let updated = 0;

  for (const supplier of suppliers) {
    const row = await reconcileSupplierBalanceRow(companyId, supplier.id);
    if (!row || row.delta === 0) continue;
    await syncSupplierBalance(companyId, supplier.id);
    updated += 1;
  }

  return { updated, total: suppliers.length };
}
