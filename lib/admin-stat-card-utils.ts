export type AdminStatTone =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple";

export const ADMIN_STAT_TONE_CLASS: Record<AdminStatTone, string> = {
  neutral: "bg-slate-50 text-slate-600",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-orange-50 text-orange-500",
  purple: "bg-violet-50 text-violet-600",
  red: "bg-rose-50 text-rose-500",
};

export function getAdminStatToneClass(tone: AdminStatTone = "blue") {
  return ADMIN_STAT_TONE_CLASS[tone];
}

export function shouldRenderStatChevron(href?: string) {
  return Boolean(href);
}

export function shouldRenderStatIconWrapper(icon?: unknown) {
  return icon !== undefined && icon !== null;
}
