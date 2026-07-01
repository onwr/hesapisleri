import "server-only";

import type { PaymentAttemptStatus } from "@prisma/client";
import { db } from "@/lib/prisma";

export type SipayResultView = {
  invoiceId: string;
  status: PaymentAttemptStatus | "UNKNOWN";
  found: boolean;
};

export async function getSipayPaymentResultForCompany(
  companyId: string,
  invoiceId: string,
): Promise<SipayResultView> {
  const attempt = await db.paymentAttempt.findFirst({
    where: { invoiceId, companyId },
    select: { status: true, invoiceId: true },
  });

  if (!attempt) {
    return { invoiceId, status: "UNKNOWN", found: false };
  }

  return { invoiceId: attempt.invoiceId, status: attempt.status, found: true };
}
