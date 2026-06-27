/** In-process create idempotency — aynı clientRequestId ile çift submit engeli */

const TTL_MS = 5 * 60 * 1000;
const recent = new Map<string, { planId: string; at: number }>();

function prune() {
  const now = Date.now();
  for (const [key, val] of recent) {
    if (now - val.at > TTL_MS) recent.delete(key);
  }
}

export function getExistingCreatePlanId(clientRequestId: string | undefined): string | null {
  if (!clientRequestId) return null;
  prune();
  return recent.get(clientRequestId)?.planId ?? null;
}

export function recordCreatePlanIdempotency(
  clientRequestId: string | undefined,
  planId: string
): void {
  if (!clientRequestId) return;
  recent.set(clientRequestId, { planId, at: Date.now() });
}

export function resetCreatePlanIdempotencyForTests(): void {
  recent.clear();
}
