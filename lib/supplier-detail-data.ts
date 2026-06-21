import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { getSupplierById } from "@/lib/supplier-service";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";

export async function getSupplierDetailData(companyId: string, supplierId: string) {
  const supplier = await getSupplierById(companyId, supplierId);
  if (!supplier) return null;

  await syncSupplierBalance(companyId, supplierId);
  const refreshed = await getSupplierById(companyId, supplierId);
  if (!refreshed) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [expenses, payments, monthExpenses, activityLogs] = await Promise.all([
    db.expense.findMany({
      where: { companyId, supplierId },
      orderBy: { date: "desc" },
      take: 50,
      include: {
        accountTransaction: {
          select: { id: true, title: true, amount: true, date: true },
        },
      },
    }),
    db.accountTransaction.findMany({
      where: {
        expense: { companyId, supplierId, paymentStatus: "PAID" },
      },
      orderBy: { date: "desc" },
      take: 20,
      include: {
        expense: { select: { id: true, title: true } },
        account: { select: { id: true, name: true } },
      },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        supplierId,
        date: { gte: monthStart },
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
    }),
    db.activityLog.findMany({
      where: { companyId, module: "suppliers", message: { contains: refreshed.name } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const unpaidExpenses = expenses.filter(
    (expense) => expense.paymentStatus === "UNPAID" && expense.status !== "CANCELLED"
  );
  const unpaidTotal = roundCashMoney(
    unpaidExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  );
  const thisMonthPurchases = roundCashMoney(Number(monthExpenses._sum.amount ?? 0));
  const lastPayment = payments[0]?.date ?? null;

  return {
    supplier: refreshed,
    summary: {
      currentBalance: roundCashMoney(Number(refreshed.currentBalance)),
      unpaidTotal,
      thisMonthPurchases,
      productCount: refreshed.supplierProducts.length,
      lastPayment,
    },
    expenses: expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: roundCashMoney(Number(expense.amount)),
      date: expense.date,
      paymentStatus: expense.paymentStatus,
      status: expense.status,
      href: `/expenses/${expense.id}`,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      title: payment.title,
      amount: roundCashMoney(Number(payment.amount)),
      date: payment.date,
      accountName: payment.account.name,
      expenseTitle: payment.expense?.title ?? null,
      expenseHref: payment.expense ? `/expenses/${payment.expense.id}` : null,
    })),
    activityLogs,
  };
}
