import type { AdminEnvironment } from "@/lib/admin-environment";
import { getAdminEnvironmentLabel } from "@/lib/admin-environment";

type AdminEnvironmentBadgeProps = {
  environment: AdminEnvironment;
  compact?: boolean;
};

export function AdminEnvironmentBadge({
  environment,
  compact = false,
}: AdminEnvironmentBadgeProps) {
  const label = getAdminEnvironmentLabel(environment);

  const className =
    environment === "production"
      ? "border-rose-100 bg-rose-50 text-rose-600"
      : environment === "staging"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-500";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold",
        className,
        compact ? "px-2 py-0.5" : "",
      ].join(" ")}
    >
      {label}
    </span>
  );
}
