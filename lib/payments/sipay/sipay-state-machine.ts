import type { PaymentAttemptStatus } from "@prisma/client";
import { SipayError } from "./sipay-errors";

// İzin verilen durum geçişleri
// İade durumları MembershipPayment üzerinde; PaymentAttempt COMPLETED terminal kalır.
const ALLOWED_TRANSITIONS: Partial<Record<PaymentAttemptStatus, PaymentAttemptStatus[]>> = {
  CREATED: ["CHECKOUT_LINK_READY", "FAILED", "CANCELLED"],
  CHECKOUT_LINK_READY: ["PENDING", "COMPLETED", "FAILED", "CANCELLED"],
  PENDING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function assertValidTransition(
  from: PaymentAttemptStatus,
  to: PaymentAttemptStatus,
): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new SipayError(
      `Geçersiz PaymentAttempt geçişi: ${from} → ${to}`,
      "INVALID_STATE_TRANSITION",
    );
  }
}

export function isTerminalStatus(status: PaymentAttemptStatus): boolean {
  return ["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"].includes(status);
}

export function canFinalize(status: PaymentAttemptStatus): boolean {
  return ["CHECKOUT_LINK_READY", "PENDING"].includes(status);
}

export function canCancel(status: PaymentAttemptStatus): boolean {
  return ["CREATED", "CHECKOUT_LINK_READY", "PENDING"].includes(status);
}

