import { db } from "@/lib/prisma";
import { buildFinanceMirrorNote } from "@/lib/finance-reversal-utils";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export async function reverseSaleIncomeTransactions(
  tx: TransactionClient,
  input: {
    companyId: string;
    saleNo: string;
    reversalTitle: string;
    reversalNote: string;
    mirrorKind?: "REVERSAL" | "CORRECTION";
  }
) {
  const incomeTransactions = await tx.accountTransaction.findMany({
    where: {
      account: { companyId: input.companyId },
      type: "INCOME",
      OR: [
        { title: { contains: input.saleNo } },
        { note: { contains: input.saleNo } },
      ],
    },
  });

  for (const incomeTx of incomeTransactions) {
    const alreadyReversed = await tx.accountTransaction.findFirst({
      where: {
        accountId: incomeTx.accountId,
        type: "EXPENSE",
        title: input.reversalTitle,
        amount: incomeTx.amount,
      },
    });

    if (alreadyReversed) continue;

    await tx.account.update({
      where: { id: incomeTx.accountId },
      data: {
        balance: {
          decrement: incomeTx.amount,
        },
      },
    });

    await tx.accountTransaction.create({
      data: {
        accountId: incomeTx.accountId,
        type: "EXPENSE",
        title: input.reversalTitle,
        amount: incomeTx.amount,
        date: new Date(),
        note: buildFinanceMirrorNote(
          input.mirrorKind ?? "REVERSAL",
          input.reversalNote
        ),
      },
    });
  }
}
