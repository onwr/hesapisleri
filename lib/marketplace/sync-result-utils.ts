export type SyncResultCounts = {
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: unknown[];
};

export function isEmptySyncResult(result: SyncResultCounts): boolean {
  const errors = Array.isArray(result.errors) ? result.errors : [];
  return (
    result.fetchedCount === 0 &&
    result.createdCount === 0 &&
    result.updatedCount === 0 &&
    result.skippedCount === 0 &&
    errors.length === 0
  );
}

export const SYNC_METRIC_HINTS = {
  fetched: "Pazaryerinden dönen sipariş sayısı.",
  created: "Panelde yeni açılan sipariş sayısı.",
  updated: "Panelde zaten bulunan ve bilgisi güncellenen sipariş sayısı.",
  skipped: "Zaten kayıtlı olan veya değişiklik gerektirmeyen siparişler.",
} as const;
