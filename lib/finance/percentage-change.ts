export type PercentageChangeResult =
  | { kind: "percent"; value: number }
  | { kind: "new" }
  | { kind: "unchanged" }
  | { kind: "no-comparison" };

export function resolvePercentageChange(
  current: number,
  previous: number
): PercentageChangeResult {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { kind: "no-comparison" };
  }

  if (previous === 0) {
    if (current === 0) return { kind: "unchanged" };
    if (current > 0) return { kind: "new" };
    return { kind: "no-comparison" };
  }

  return {
    kind: "percent",
    value: Math.round(((current - previous) / previous) * 100),
  };
}

export type PercentageChangeBadge = {
  label: string;
  positive: boolean;
  /** Numeric percent when applicable; null signals a non-percent label (Yeni, vb.). */
  changePercent: number | null;
  ariaLabel: string;
};

export function formatPercentageChangeBadge(
  result: PercentageChangeResult,
  options?: { invert?: boolean }
): PercentageChangeBadge {
  const invert = options?.invert ?? false;

  switch (result.kind) {
    case "percent": {
      const positive = invert ? result.value <= 0 : result.value >= 0;
      const sign = result.value >= 0 ? "+" : "";
      return {
        label: `${sign}${result.value}%`.replace("+-", "-"),
        positive,
        changePercent: result.value,
        ariaLabel: `${positive ? "Artış" : "Azalış"} yüzde ${Math.abs(result.value)}`,
      };
    }
    case "new":
      return {
        label: "Yeni",
        positive: !invert,
        changePercent: null,
        ariaLabel: "Önceki dönemde veri yok, yeni kayıt var",
      };
    case "unchanged":
      return {
        label: "Değişim yok",
        positive: true,
        changePercent: 0,
        ariaLabel: "Değişim yok",
      };
    case "no-comparison":
      return {
        label: "Karşılaştırma yok",
        positive: true,
        changePercent: null,
        ariaLabel: "Karşılaştırma yapılamıyor",
      };
  }
}

/** @deprecated Prefer resolvePercentageChange — kept for gradual migration. */
export function percentChange(current: number, previous: number): number | null {
  const resolved = resolvePercentageChange(current, previous);
  if (resolved.kind === "percent") return resolved.value;
  if (resolved.kind === "unchanged") return 0;
  return null;
}
