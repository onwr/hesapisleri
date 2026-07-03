export type CompactActionColor =
  | "emerald"
  | "blue"
  | "violet"
  | "orange"
  | "rose"
  | "sky"
  | "amber"
  | "slate"
  | "navy";

export const COMPACT_ACTION_ICON_NAMES = [
  "truck",
  "wallet",
  "bell-ring",
  "file-spreadsheet",
  "user-x",
  "user-plus",
  "users",
  "mail",
  "shopping-cart",
  "file-text",
  "refresh-ccw",
  "receipt-text",
  "repeat",
  "banknote",
  "plus",
  "building-2",
  "receipt",
  "bar-chart-3",
  "sparkles",
  "boxes",
  "warehouse",
  "link-2",
  "barcode",
  "plug-zap",
  "credit-card",
  "bell",
  "target",
  "download",
  "trending-up",
  "user",
  "package",
  "clock",
  "alert-triangle",
  "layout-grid",
  "hourglass",
  "shopping-bag",
  "package-check",
  "alert-circle",
  "book-user",
  "send",
  "upload",
  "brain",
  "message-circle",
] as const;

export type CompactActionIconName = (typeof COMPACT_ACTION_ICON_NAMES)[number];

export function isCompactActionIconName(
  value: string
): value is CompactActionIconName {
  return (COMPACT_ACTION_ICON_NAMES as readonly string[]).includes(value);
}
