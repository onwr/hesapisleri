export type HealthCheckStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "UNHEALTHY"
  | "UNKNOWN"
  | "NOT_CONFIGURED";

export type HealthCheckCategory =
  | "application"
  | "database"
  | "prisma"
  | "cache"
  | "storage"
  | "payment"
  | "billing"
  | "email"
  | "integrations"
  | "cron";

export type HealthCheckCriticality = "critical" | "normal";

export type HealthIssueCode =
  | "DATABASE_UNREACHABLE"
  | "DATABASE_SLOW"
  | "MIGRATION_PENDING"
  | "CACHE_UNAVAILABLE"
  | "STORAGE_UNAVAILABLE"
  | "PAYMENT_NOT_CONFIGURED"
  | "CALLBACK_FAILURES"
  | "OUTBOX_FAILED"
  | "OUTBOX_STUCK"
  | "CRON_OVERDUE"
  | "INTEGRATION_SYNC_STALE"
  | "MAIL_NOT_CONFIGURED"
  | "HIGH_MEMORY_USAGE";

export type HealthCheckDefinition = {
  id: string;
  label: string;
  category: HealthCheckCategory;
  criticality: HealthCheckCriticality;
};

export type HealthCheckResult = {
  id: string;
  label: string;
  category: HealthCheckCategory;
  criticality: HealthCheckCriticality;
  status: HealthCheckStatus;
  summary: string;
  durationMs: number;
  checkedAt: string;
  details: Record<string, unknown>;
  suggestedAction: string | null;
  issues: HealthIssueCode[];
};

export type OverallHealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";

export const HEALTH_CHECK_DEFINITIONS: HealthCheckDefinition[] = [
  { id: "app-runtime", label: "Uygulama runtime", category: "application", criticality: "normal" },
  { id: "database-connection", label: "Veritabanı bağlantısı", category: "database", criticality: "critical" },
  { id: "database-migrations", label: "Migration durumu", category: "database", criticality: "critical" },
  { id: "prisma-client", label: "Prisma client", category: "prisma", criticality: "critical" },
  { id: "platform-cache", label: "Platform cache", category: "cache", criticality: "normal" },
  { id: "cdn-storage", label: "Dosya depolama (CDN)", category: "storage", criticality: "normal" },
  { id: "paytr-config", label: "PayTR yapılandırması", category: "payment", criticality: "critical" },
  { id: "payment-activity", label: "Ödeme aktivitesi", category: "payment", criticality: "normal" },
  { id: "billing-outbox", label: "Billing outbox", category: "billing", criticality: "critical" },
  { id: "mail-provider", label: "E-posta sağlayıcı", category: "email", criticality: "normal" },
  { id: "marketplace-integrations", label: "Pazaryeri entegrasyonları", category: "integrations", criticality: "normal" },
  { id: "efaturam-integrations", label: "e-Fatura (Sovos/Efaturam)", category: "integrations", criticality: "normal" },
  { id: "cron-jobs", label: "Cron / job altyapısı", category: "cron", criticality: "normal" },
];

export const HEALTH_CHECK_IDS = new Set(HEALTH_CHECK_DEFINITIONS.map((c) => c.id));

export function getHealthCheckDefinition(id: string): HealthCheckDefinition | undefined {
  return HEALTH_CHECK_DEFINITIONS.find((c) => c.id === id);
}

export function aggregateOverallStatus(checks: HealthCheckResult[]): OverallHealthStatus {
  if (checks.length === 0) return "UNKNOWN";

  const critical = checks.filter((c) => c.criticality === "critical");
  const nonCritical = checks.filter((c) => c.criticality === "normal");

  if (critical.some((c) => c.status === "UNHEALTHY")) return "UNHEALTHY";
  if (critical.some((c) => c.status === "DEGRADED")) return "DEGRADED";

  if (nonCritical.some((c) => c.status === "UNHEALTHY" || c.status === "DEGRADED")) {
    return "DEGRADED";
  }

  const criticalHasActiveFailure = critical.some(
    (c) => c.status === "UNHEALTHY" || c.status === "DEGRADED"
  );

  if (
    critical.length > 0 &&
    !criticalHasActiveFailure &&
    critical.some((c) => c.status === "NOT_CONFIGURED")
  ) {
    return "DEGRADED";
  }

  if (
    critical.some((c) => c.status === "UNKNOWN") &&
    !criticalHasActiveFailure &&
    !critical.some((c) => c.status === "NOT_CONFIGURED")
  ) {
    return "DEGRADED";
  }

  return "HEALTHY";
}
