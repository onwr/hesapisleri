/** Tab bazlı query parametreleri — bir tabın sayfası diğerini etkilemez */

export function normalizeTabPage(page: number | undefined, fallback = 1): number {
  if (!page || page < 1) return fallback;
  return page;
}

export function pickTabPage(
  raw: Record<string, string | string[] | undefined>,
  tabPrefix: "subscriptions" | "history" | "activity"
): number {
  const specific = raw[`${tabPrefix}Page`];
  const generic = raw.page;
  const val =
    (Array.isArray(specific) ? specific[0] : specific) ??
    (Array.isArray(generic) ? generic[0] : generic);
  const n = val ? Number(val) : 1;
  return normalizeTabPage(Number.isFinite(n) ? n : 1);
}
