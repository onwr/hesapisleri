import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";

export async function calculateSupplierBalance(companyId: string, supplierId: string) {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, companyId },
    select: { openingBalance: true },
  });

  if (!supplier) {
    return null;
  }

  const unpaid = await db.expense.aggregate({
    where: {
      companyId,
      supplierId,
      paymentStatus: "UNPAID",
      status: { not: "CANCELLED" },
    },
    _sum: { amount: true },
  });

  const opening = roundCashMoney(Number(supplier.openingBalance));
  const payable = roundCashMoney(Number(unpaid._sum.amount ?? 0));

  return roundCashMoney(opening + payable);
}

export async function syncSupplierBalance(companyId: string, supplierId: string) {
  const balance = await calculateSupplierBalance(companyId, supplierId);
  if (balance === null) return null;

  return db.supplier.update({
    where: { id: supplierId },
    data: { currentBalance: balance },
  });
}

export async function syncAllSupplierBalances(companyId: string) {
  const suppliers = await db.supplier.findMany({
    where: { companyId },
    select: { id: true },
  });

  let updated = 0;

  for (const supplier of suppliers) {
    await syncSupplierBalance(companyId, supplier.id);
    updated += 1;
  }

  return { updated };
}

export async function getSupplierSummary(companyId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [suppliers, unpaidAgg, monthExpenses, monthPaidExpenses, linkedProducts] = await Promise.all([
    db.supplier.findMany({
      where: { companyId },
      select: {
        id: true,
        isActive: true,
        isFavorite: true,
        currentBalance: true,
      },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        supplierId: { not: null },
        paymentStatus: "UNPAID",
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        supplierId: { not: null },
        date: { gte: monthStart },
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        supplierId: { not: null },
        date: { gte: monthStart },
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
    }),
    db.supplierProduct.groupBy({
      by: ["supplierId"],
      where: { companyId },
    }),
  ]);

  const payableTotal = roundCashMoney(Number(unpaidAgg._sum.amount ?? 0));
  const overduePayable = payableTotal;
  const thisMonthPurchases = roundCashMoney(Number(monthExpenses._sum.amount ?? 0));
  const thisMonthPaid = roundCashMoney(Number(monthPaidExpenses._sum.amount ?? 0));

  return {
    total: suppliers.length,
    active: suppliers.filter((item) => item.isActive).length,
    favorite: suppliers.filter((item) => item.isFavorite).length,
    payableTotal,
    overduePayable,
    thisMonthPurchases,
    thisMonthPaid,
    linkedProductSuppliers: linkedProducts.length,
  };
}
