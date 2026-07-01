import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type DashboardMembershipAlertProps = {
  message: string;
  actionUrl: string;
  type: "expired" | "expiring";
};

export function DashboardMembershipAlert({
  message,
  actionUrl,
  type,
}: DashboardMembershipAlertProps) {
  const isExpired = type === "expired";

  return (
    <div
      className={[
        "rounded-[1.75rem] border px-5 py-4",
        isExpired
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-amber-200 bg-amber-50 text-amber-950",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={20}
            className={isExpired ? "text-red-600" : "text-amber-600"}
          />
          <p className="text-sm font-semibold leading-6">{message}</p>
        </div>
        <Link
          href={actionUrl}
          className={[
            "inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-black",
            isExpired
              ? "bg-red-600 text-white"
              : "bg-amber-600 text-white",
          ].join(" ")}
        >
          Üyelik ve Ödeme
        </Link>
      </div>
    </div>
  );
}
