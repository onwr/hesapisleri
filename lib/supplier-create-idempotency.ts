/** In-process supplier create idempotency — aynı clientRequestId ile çift submit engeli */

const TTL_MS = 5 * 60 * 1000;
const recent = new Map<string, { supplierId: string; at: number }>();

function key(companyId: string, clientRequestId: string) {
  return `${companyId}:${clientRequestId}`;
}

function prune() {
  const now = Date.now();
  for (const [k, val] of recent) {
    if (now - val.at > TTL_MS) recent.delete(k);
  }
}

export function getExistingCreateSupplierId(
  companyId: string,
  clientRequestId: string | undefined
): string | null {
  if (!clientRequestId) return null;
  prune();
  return recent.get(key(companyId, clientRequestId))?.supplierId ?? null;
}

export function recordCreateSupplierIdempotency(
  companyId: string,
  clientRequestId: string | undefined,
  supplierId: string
): void {
  if (!clientRequestId) return;
  recent.set(key(companyId, clientRequestId), { supplierId, at: Date.now() });
}

export function resetCreateSupplierIdempotencyForTests(): void {
  recent.clear();
}
