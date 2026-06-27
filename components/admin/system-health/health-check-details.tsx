"use client";

import Link from "next/link";
import { formatHealthDetailScalar } from "@/lib/admin/system-health/system-health-serializers";

const DETAIL_LABELS: Record<string, string> = {
  heapUsedMb: "Heap kullanılan (MB)",
  heapTotalMb: "Heap toplam (MB)",
  heapLimitMb: "Heap limit (MB)",
  rssMb: "RSS (MB)",
  heapLimitUsageRatio: "Heap limit oranı",
  cronSecretConfigured: "CRON secret",
  registeredCronRoutes: "Cron rotaları",
  historicalRolledBackCount: "Tarihsel rollback",
  activeFailedCount: "Aktif başarısız",
  pendingCount: "Bekleyen",
  stuckPendingCount: "Takılı pending",
  failedCount: "Başarısız",
  configuredCompanyCount: "Yapılandırılmış",
  connectedCount: "Bağlı",
  errorCount: "Hata",
  staleSyncCount: "Gecikmiş sync",
  missing: "Eksik env",
  invalid: "Geçersiz env",
  links: "Bağlantılar",
};

function labelForKey(key: string) {
  return DETAIL_LABELS[key] ?? key;
}

function renderScalar(value: unknown) {
  return formatHealthDetailScalar(value);
}

function renderArray(key: string, value: unknown[]) {
  if (value.length === 0) {
    return <span className="text-slate-500">—</span>;
  }

  if (value.every((item) => typeof item !== "object" || item == null)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, index) => (
          <span
            key={`${key}-${index}`}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"
          >
            {renderScalar(item)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <details className="text-[11px]">
      <summary className="cursor-pointer text-slate-600">{value.length} öğe</summary>
      <div className="mt-1 space-y-1 border-l border-slate-200 pl-2">
        {value.map((item, index) => (
          <div key={`${key}-${index}`}>
            {typeof item === "object" && item != null ? (
              <HealthCheckDetails details={item as Record<string, unknown>} compact />
            ) : (
              <span>{renderScalar(item)}</span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function renderLinks(links: Record<string, unknown>) {
  const entries = Object.entries(links).filter(([, href]) => typeof href === "string");
  if (entries.length === 0) return <span className="text-slate-500">—</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([name, href]) => (
        <Link
          key={name}
          href={href as string}
          className="text-[11px] font-medium text-blue-700 underline-offset-2 hover:underline"
        >
          {labelForKey(name)}
        </Link>
      ))}
    </div>
  );
}

export function HealthCheckDetails({
  details,
  compact = false,
  limit = 8,
}: {
  details: Record<string, unknown>;
  compact?: boolean;
  limit?: number;
}) {
  const entries = Object.entries(details).slice(0, limit);

  if (entries.length === 0) {
    return <span className="text-slate-500">—</span>;
  }

  return (
    <dl className={`space-y-1 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(0,42%)_1fr] gap-x-2 gap-y-0.5">
          <dt className="truncate font-medium text-slate-600">{labelForKey(key)}</dt>
          <dd className="min-w-0 text-slate-700">
            {key === "links" && value && typeof value === "object" && !Array.isArray(value) ? (
              renderLinks(value as Record<string, unknown>)
            ) : Array.isArray(value) ? (
              renderArray(key, value)
            ) : value != null && typeof value === "object" ? (
              <HealthCheckDetails details={value as Record<string, unknown>} compact limit={6} />
            ) : (
              renderScalar(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
