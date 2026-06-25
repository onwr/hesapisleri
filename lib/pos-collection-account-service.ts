import { db } from "@/lib/prisma";
import { serializeAccountOption } from "@/lib/account-utils";
import type { PosCollectionAccount } from "@/lib/pos-payment-account-utils";

const posCollectionAccountSelect = {
  id: true,
  name: true,
  type: true,
  balance: true,
  currency: true,
  isDefault: true,
  bankName: true,
  iban: true,
  status: true,
} as const;

export async function getPosCollectionAccountOptions(
  companyId: string
): Promise<PosCollectionAccount[]> {
  const accounts = await db.account.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      type: { in: ["CASH", "BANK", "STATIC", "POS"] },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: posCollectionAccountSelect,
  });

  return accounts.map((account) => ({
    ...serializeAccountOption(account),
    bankName: account.bankName,
    iban: account.iban,
    status: account.status,
  }));
}
