import "server-only";

import { addMonths } from "@/lib/membership-utils";

const RETRY_OFFSETS_DAYS = [0, 1, 3, 5, 7] as const;
export const DEFAULT_GRACE_DAYS = 7;

export function calculateNextRetryAt(attemptNo: number, referenceDate = new Date()) {
  const offset = RETRY_OFFSETS_DAYS[attemptNo] ?? null;
  if (offset === null) return null;
  const next = new Date(referenceDate);
  next.setDate(next.getDate() + offset);
  return next;
}

export function calculateGraceEndsAt(referenceDate = new Date()) {
  const grace = new Date(referenceDate);
  grace.setDate(grace.getDate() + DEFAULT_GRACE_DAYS);
  return grace;
}

export function calculateRenewalLookahead(referenceDate = new Date()) {
  return addMonths(referenceDate, 1);
}
