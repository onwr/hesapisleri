import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { db } from "@/lib/prisma";

export const INSUFFICIENT_CASH_BALANCE_MESSAGE =
  "Hesap bakiyesi bu ödeme için yetersiz.";

export function hasInsufficientCashBalance(
  balance: unknown,
  amount: number,
  allowNegativeCashBalance: boolean
): boolean {
  if (allowNegativeCashBalance) {
    return false;
  }

  return roundCashMoney(Number(balance ?? 0)) < roundCashMoney(amount);
}

export async function getCompanyAllowNegativeCashBalance(
  companyId: string
): Promise<boolean> {
  const settings = await db.companySettings.findUnique({
    where: { companyId },
    select: { allowNegativeCashBalance: true },
  });

  return settings?.allowNegativeCashBalance ?? false;
}
