import "server-only";

import { db } from "@/lib/prisma";
import { createPaytrAdapter } from "@/lib/payments/providers/paytr/paytr-adapter";

export async function runPaymentReconciliation(referenceDate = new Date()) {
  const threshold = new Date(referenceDate.getTime() - 10 * 60 * 1000);
  const payments = await db.membershipPayment.findMany({
    where: {
      provider: "PayTR",
      status: { in: ["WAIT_CALLBACK", "UNKNOWN", "PENDING"] },
      createdAt: { lte: threshold },
      merchantOid: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let checked = 0;
  let discrepancies = 0;

  for (const payment of payments) {
    if (!payment.merchantOid) continue;
    checked += 1;
    const provider = await createPaytrAdapter().queryPayment({
      merchantOid: payment.merchantOid,
    });

    const localAmountMinor = payment.amountMinor ?? Math.round(Number(payment.amount) * 100);
    const discrepancyType =
      provider.amountMinor != null && provider.amountMinor !== localAmountMinor
        ? "AMOUNT_MISMATCH"
        : provider.status !== payment.status
          ? "STATUS_MISMATCH"
          : null;

    if (discrepancyType) {
      discrepancies += 1;
      await db.paymentReconciliation.create({
        data: {
          paymentId: payment.id,
          provider: "PAYTR",
          localStatus: payment.status,
          providerStatus: provider.providerStatus,
          localAmountMinor,
          providerAmountMinor: provider.amountMinor,
          discrepancyType,
          details: provider.raw ? { provider: provider.raw } : undefined,
        },
      });
    }
  }

  return { checked, discrepancies };
}
