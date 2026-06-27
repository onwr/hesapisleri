import "server-only";

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/prisma";
import { checkDatabaseHealth } from "@/lib/db-health";
import { JOB_REGISTRY, getJobDefinition } from "@/lib/admin/jobs/job-registry";
import {
  countStuckOutboxPending,
  evaluateCronHealth,
  isProductionRuntime,
} from "@/lib/admin/system-health/health-cron-utils";
import { evaluateMigrationHealth } from "@/lib/admin/system-health/health-migration-utils";
import {
  captureMemorySnapshot,
  evaluateMemoryHealth,
} from "@/lib/admin/system-health/health-memory-utils";
import {
  getHealthCheckDefinition,
  type HealthCheckDefinition,
  type HealthCheckResult,
  type HealthCheckStatus,
  type HealthIssueCode,
} from "@/lib/admin/system-health/system-health-registry";
import { probeEnvFields } from "@/lib/admin/system-health/system-health-serializers";
import { runCacheProbe } from "@/lib/admin/system-health/system-health-cache";

const CHECK_TIMEOUT_MS = 8_000;

function makeResult(
  def: HealthCheckDefinition,
  status: HealthCheckStatus,
  summary: string,
  durationMs: number,
  details: Record<string, unknown> = {},
  suggestedAction: string | null = null,
  issues: HealthIssueCode[] = []
): HealthCheckResult {
  return {
    id: def.id,
    label: def.label,
    category: def.category,
    criticality: def.criticality,
    status,
    summary,
    durationMs,
    checkedAt: new Date().toISOString(),
    details,
    suggestedAction,
    issues,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Check timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runHealthCheckById(checkId: string): Promise<HealthCheckResult> {
  const def = getHealthCheckDefinition(checkId);
  if (!def) {
    throw new Error("Bilinmeyen health check.");
  }

  const started = Date.now();
  try {
    const result = await withTimeout(executeCheck(def), CHECK_TIMEOUT_MS);
    return { ...result, durationMs: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check başarısız";
    return makeResult(
      def,
      "UNKNOWN",
      message,
      Date.now() - started,
      { error: message },
      "Kontrol tekrar çalıştırılabilir; sorun devam ederse logları inceleyin."
    );
  }
}

async function executeCheck(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  switch (def.id) {
    case "app-runtime":
      return checkAppRuntime(def);
    case "database-connection":
      return checkDatabaseConnection(def);
    case "database-migrations":
      return checkDatabaseMigrations(def);
    case "prisma-client":
      return checkPrismaClient(def);
    case "platform-cache":
      return checkPlatformCache(def);
    case "cdn-storage":
      return checkCdnStorage(def);
    case "paytr-config":
      return checkPaytrConfig(def);
    case "payment-activity":
      return checkPaymentActivity(def);
    case "billing-outbox":
      return checkBillingOutbox(def);
    case "mail-provider":
      return checkMailProvider(def);
    case "marketplace-integrations":
      return checkMarketplaceIntegrations(def);
    case "efaturam-integrations":
      return checkEfaturamIntegrations(def);
    case "cron-jobs":
      return checkCronJobs(def);
    default:
      return makeResult(def, "UNKNOWN", "Check uygulanmadı.", 0);
  }
}

function checkAppRuntime(def: HealthCheckDefinition): HealthCheckResult {
  const snapshot = captureMemorySnapshot();
  const isProduction = isProductionRuntime();
  const memoryEval = evaluateMemoryHealth(snapshot, isProduction);

  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.GIT_COMMIT?.slice(0, 7) ??
    null;

  return makeResult(
    def,
    memoryEval.status,
    memoryEval.summary,
    0,
    {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? "unknown",
      isProductionRuntime: isProduction,
      uptimeSeconds: Math.floor(process.uptime()),
      heapUsedMb: snapshot.heapUsedMb,
      heapTotalMb: snapshot.heapTotalMb,
      heapLimitMb: snapshot.heapLimitMb,
      rssMb: snapshot.rssMb,
      heapLimitUsageRatio: snapshot.heapLimitUsageRatio,
      appVersion: commit,
      runtime: "nodejs",
    },
    memoryEval.status === "DEGRADED"
      ? "Yüksek bellek kullanımında instance yeniden başlatmayı değerlendirin."
      : null,
    memoryEval.issues
  );
}

async function checkDatabaseConnection(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  try {
    const result = await checkDatabaseHealth();
    const issues: HealthIssueCode[] = [];
    let status: HealthCheckStatus = "HEALTHY";
    let summary = `Bağlantı OK (${result.latencyMs}ms).`;

    if (result.latencyMs > 2000) {
      status = "UNHEALTHY";
      issues.push("DATABASE_SLOW");
      summary = `Veritabanı çok yavaş (${result.latencyMs}ms).`;
    } else if (result.latencyMs > 500) {
      status = "DEGRADED";
      issues.push("DATABASE_SLOW");
      summary = `Veritabanı yavaş (${result.latencyMs}ms).`;
    }

    return makeResult(
      def,
      status,
      summary,
      result.latencyMs,
      {
        latencyMs: result.latencyMs,
        poolerConfigured: result.poolerConfigured,
        accelerateConfigured: result.accelerateConfigured,
      },
      issues.length ? "DB pooler/latency ve aktif sorguları kontrol edin." : null,
      issues
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bağlantı hatası";
    return makeResult(
      def,
      "UNHEALTHY",
      "Veritabanına ulaşılamıyor.",
      0,
      { error: message },
      "DATABASE_URL ve DB erişimini doğrulayın.",
      ["DATABASE_UNREACHABLE"]
    );
  }
}

async function checkDatabaseMigrations(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  const rows = await db.$queryRaw<
    Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
      applied_steps_count: number;
    }>
  >`SELECT migration_name, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST`;

  const appliedNames = new Set(rows.filter((r) => r.finished_at).map((r) => r.migration_name));

  let pending: string[] = [];
  try {
    const dir = join(process.cwd(), "prisma", "migrations");
    const local = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
    pending = local.filter((m) => !appliedNames.has(m));
  } catch {
    // migration dir okunamazsa pending bilinmiyor
  }

  const evaluation = evaluateMigrationHealth(rows, pending);

  return makeResult(
    def,
    evaluation.status,
    evaluation.summary,
    0,
    {
      appliedCount: evaluation.appliedCount,
      activeFailedCount: evaluation.activeFailedCount,
      historicalRolledBackCount: evaluation.historicalRolledBackCount,
      pendingCount: evaluation.pendingCount,
      latestMigration: rows[0]?.migration_name ?? null,
      pendingSample: pending.slice(0, 5),
    },
    evaluation.issues.length
      ? "npx prisma migrate deploy çalıştırın ve migration loglarını inceleyin."
      : null,
    evaluation.issues
  );
}

async function checkPrismaClient(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [ping, prismaErrors] = await Promise.all([
    db.$queryRaw`SELECT 1 as ok`,
    db.activityLog.count({
      where: {
        createdAt: { gte: since },
        OR: [
          { message: { contains: "Prisma", mode: "insensitive" } },
          { message: { contains: "P20", mode: "insensitive" } },
        ],
      },
    }),
  ]);

  const ok = Array.isArray(ping) && ping.length > 0;
  const status: HealthCheckStatus = ok ? (prismaErrors > 0 ? "DEGRADED" : "HEALTHY") : "UNHEALTHY";

  return makeResult(
    def,
    status,
    ok ? "Prisma client çalışıyor." : "Prisma client yanıt vermiyor.",
    0,
    {
      clientResponsive: ok,
      prismaRelatedLogErrors24h: prismaErrors,
      accelerateConfigured: Boolean(process.env.PRISMA_ACCELERATE_URL?.trim()),
    },
    prismaErrors > 0 ? "Son 24 saatte Prisma ile ilgili activity log kayıtlarını inceleyin." : null
  );
}

function checkPlatformCache(def: HealthCheckDefinition): HealthCheckResult {
  const redisUrl = process.env.AI_RATE_LIMIT_REDIS_URL?.trim();
  if (redisUrl) {
    return makeResult(
      def,
      "NOT_CONFIGURED",
      "Redis URL tanımlı ancak uygulama adapter kullanmıyor.",
      0,
      { redisEnvPresent: true, activeBackend: "database-fallback" },
      "Redis adapter tamamlanana kadar DB fallback kullanılıyor."
    );
  }

  const probe = runCacheProbe();
  const platformCache = "next-unstable_cache";

  return makeResult(
    def,
    probe.ok ? "HEALTHY" : "DEGRADED",
    probe.ok ? "Namespaced probe başarılı." : "Cache probe başarısız.",
    0,
    { backend: platformCache, probeBackend: probe.backend, probeOk: probe.ok },
    probe.ok ? null : "Uygulama cache katmanını kontrol edin.",
    probe.ok ? [] : ["CACHE_UNAVAILABLE"]
  );
}

async function checkCdnStorage(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  const env = probeEnvFields([
    { key: "CDN_UPLOAD_URL", required: true },
    { key: "CDN_UPLOAD_TOKEN", required: false },
    { key: "CDN_BASE_URL", required: false },
  ]);

  if (!env.configured) {
    return makeResult(
      def,
      "NOT_CONFIGURED",
      "CDN depolama yapılandırılmamış.",
      0,
      { storageType: "cdn-remote", ...env },
      "CDN_UPLOAD_URL ve ilgili env alanlarını tanımlayın.",
      ["STORAGE_UNAVAILABLE"]
    );
  }

  let reachable: boolean | null = null;
  const baseUrl = process.env.CDN_BASE_URL?.trim();
  if (baseUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(baseUrl, { method: "HEAD", signal: controller.signal });
      clearTimeout(timer);
      reachable = res.ok || res.status < 500;
    } catch {
      reachable = false;
    }
  }

  const status: HealthCheckStatus =
    reachable === false ? "DEGRADED" : "HEALTHY";

  return makeResult(
    def,
    status,
    reachable === false ? "CDN base URL erişilemiyor." : "CDN yapılandırması mevcut.",
    0,
    {
      storageType: "cdn-remote",
      configured: true,
      missing: env.missing,
      invalid: env.invalid,
      baseUrlReachable: reachable,
      uploadConfigured: Boolean(process.env.CDN_UPLOAD_URL?.trim()),
      tokenConfigured: Boolean(process.env.CDN_UPLOAD_TOKEN?.trim()),
    },
    reachable === false ? "CDN sunucusu ve ağ erişimini kontrol edin." : null,
    reachable === false ? ["STORAGE_UNAVAILABLE"] : []
  );
}

function checkPaytrConfig(def: HealthCheckDefinition): HealthCheckResult {
  const testMode =
    ["1", "true", "yes", "on"].includes((process.env.PAYTR_TEST_MODE ?? "").toLowerCase()) ||
    process.env.NODE_ENV !== "production";

  const env = probeEnvFields([
    { key: "PAYTR_MERCHANT_ID", required: !testMode },
    { key: "PAYTR_MERCHANT_KEY", required: !testMode },
    { key: "PAYTR_MERCHANT_SALT", required: !testMode },
    { key: "APP_URL", required: false },
  ]);

  const callbackRoute = "/api/payments/paytr/callback";
  const configured = env.configured || testMode;

  return makeResult(
    def,
    configured ? "HEALTHY" : "UNHEALTHY",
    configured ? "PayTR yapılandırması tamam." : "PayTR zorunlu alanlar eksik.",
    0,
    {
      configured,
      testMode,
      missing: env.missing,
      invalid: env.invalid,
      callbackRouteExists: true,
      integrationMode: process.env.PAYTR_INTEGRATION_MODE ?? "iframe",
    },
    configured ? null : "PayTR merchant env alanlarını tanımlayın.",
    configured ? [] : ["PAYMENT_NOT_CONFIGURED"]
  );
}

async function checkPaymentActivity(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [lastPaid, lastFailed, callbackFailures, waitCallback] = await Promise.all([
    db.membershipPayment.findFirst({
      where: { status: "PAID", paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      select: { paidAt: true },
    }),
    db.membershipPayment.findFirst({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    db.paymentWebhookEvent.count({
      where: {
        receivedAt: { gte: since24h },
        signatureValid: false,
      },
    }),
    db.membershipPayment.count({
      where: { status: { in: ["WAIT_CALLBACK", "UNKNOWN"] } },
    }),
  ]);

  const issues: HealthIssueCode[] = [];
  let status: HealthCheckStatus = "HEALTHY";
  let summary = "Ödeme aktivitesi normal.";

  if (callbackFailures > 0) {
    status = "DEGRADED";
    issues.push("CALLBACK_FAILURES");
    summary = `Son 24 saatte ${callbackFailures} callback doğrulama hatası.`;
  }

  return makeResult(
    def,
    status,
    summary,
    0,
    {
      lastSuccessfulPaymentAt: lastPaid?.paidAt?.toISOString() ?? null,
      lastFailedPaymentAt: lastFailed?.updatedAt?.toISOString() ?? null,
      callbackVerificationFailures24h: callbackFailures,
      waitingCallbackCount: waitCallback,
    },
    issues.length ? "Payment webhook loglarını ve PayTR callback ayarlarını inceleyin." : null,
    issues
  );
}

async function checkBillingOutbox(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  const outboxJob = getJobDefinition("billing-outbox");
  const stuckAfterMs = outboxJob?.overdueAfterMs ?? 15 * 60 * 1000;
  const now = new Date();

  const [failed, pendingRows, lastProcessed, orphanPayments, orphanSubs] = await Promise.all([
    db.billingOutboxEvent.count({ where: { status: "FAILED" } }),
    db.billingOutboxEvent.findMany({
      where: { status: "PENDING" },
      select: { availableAt: true },
    }),
    db.billingOutboxEvent.findFirst({
      where: { status: "PROCESSED", processedAt: { not: null } },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true, type: true },
    }),
    db.membershipPayment.count({
      where: { status: "PAID", subscriptionId: null, companyId: { not: "" } },
    }),
    db.companySubscription.count({
      where: { status: "ACTIVE", planId: null },
    }),
  ]);

  const stuck = countStuckOutboxPending(pendingRows, now, stuckAfterMs);

  const issues: HealthIssueCode[] = [];
  let status: HealthCheckStatus = "HEALTHY";
  let summary = "Billing outbox sağlıklı.";

  if (failed > 0) {
    status = "UNHEALTHY";
    issues.push("OUTBOX_FAILED");
    summary = `${failed} başarısız outbox kaydı.`;
  } else if (stuck > 0) {
    status = "DEGRADED";
    issues.push("OUTBOX_STUCK");
    summary = `${stuck} takılı pending outbox.`;
  }

  return makeResult(
    def,
    status,
    summary,
    0,
    {
      failedCount: failed,
      pendingCount: pendingRows.length,
      stuckPendingCount: stuck,
      stuckAfterMs,
      lastProcessedAt: lastProcessed?.processedAt?.toISOString() ?? null,
      lastProcessedType: lastProcessed?.type ?? null,
      orphanPaidPayments: orphanPayments,
      orphanActiveSubscriptions: orphanSubs,
      links: {
        billingOutboxJobs: "/admin/jobs/billing-outbox",
        payments: "/admin/payments",
        subscriptions: "/admin/subscriptions",
      },
    },
    issues.length ? "billing-outbox cron ve FAILED kayıtları inceleyin." : null,
    issues
  );
}

function checkMailProvider(def: HealthCheckDefinition): HealthCheckResult {
  const env = probeEnvFields([
    { key: "SMTP_HOST", required: true },
    { key: "SMTP_PORT", required: false },
    { key: "SMTP_USER", required: false },
    { key: "SMTP_PASSWORD", required: false },
    { key: "RESEND_API_KEY", required: false },
    { key: "SENDGRID_API_KEY", required: false },
  ]);

  const hasProvider =
    Boolean(process.env.SMTP_HOST?.trim()) ||
    Boolean(process.env.RESEND_API_KEY?.trim()) ||
    Boolean(process.env.SENDGRID_API_KEY?.trim());

  if (!hasProvider) {
    return makeResult(
      def,
      "NOT_CONFIGURED",
      "E-posta sağlayıcı yapılandırılmamış.",
      0,
      { configured: false, missing: ["SMTP_HOST|RESEND_API_KEY|SENDGRID_API_KEY"] },
      "SMTP veya transactional mail API anahtarı tanımlayın.",
      ["MAIL_NOT_CONFIGURED"]
    );
  }

  return makeResult(
    def,
    env.missing.length && !process.env.RESEND_API_KEY?.trim() && !process.env.SENDGRID_API_KEY?.trim()
      ? "DEGRADED"
      : "HEALTHY",
    "E-posta sağlayıcı yapılandırılmış.",
    0,
    {
      configured: true,
      provider:
        process.env.RESEND_API_KEY?.trim()
          ? "resend"
          : process.env.SENDGRID_API_KEY?.trim()
            ? "sendgrid"
            : "smtp",
      missing: env.missing,
      invalid: env.invalid,
    },
    null
  );
}

async function checkMarketplaceIntegrations(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeWhere = {
    credentialsEncrypted: { not: null },
    syncEnabled: true,
  } as const;

  const [configured, connected, errorCount, stale, lastSync] = await Promise.all([
    db.marketplaceIntegration.count({ where: activeWhere }),
    db.marketplaceIntegration.count({
      where: { ...activeWhere, status: "CONNECTED" },
    }),
    db.marketplaceIntegration.count({
      where: { ...activeWhere, status: "ERROR" },
    }),
    db.marketplaceIntegration.count({
      where: {
        ...activeWhere,
        status: "CONNECTED",
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: staleBefore } }],
      },
    }),
    db.marketplaceIntegration.findFirst({
      where: { lastSyncAt: { not: null }, ...activeWhere },
      orderBy: { lastSyncAt: "desc" },
      select: { lastSyncAt: true, channel: true },
    }),
  ]);

  if (configured === 0) {
    return makeResult(
      def,
      "NOT_CONFIGURED",
      "Aktif pazaryeri entegrasyonu yok.",
      0,
      { configuredCompanyCount: 0, connectedCount: 0 },
      null,
      []
    );
  }

  const issues: HealthIssueCode[] = [];
  let status: HealthCheckStatus = "HEALTHY";
  let summary = `${connected} bağlı, ${errorCount} aktif hata.`;

  if (errorCount > 0) {
    status = "DEGRADED";
  }
  if (stale > 0) {
    status = "DEGRADED";
    issues.push("INTEGRATION_SYNC_STALE");
    summary = `${stale} entegrasyon 24 saatten uzun süredir sync olmamış.`;
  }

  return makeResult(
    def,
    status,
    summary,
    0,
    {
      configuredCompanyCount: configured,
      connectedCount: connected,
      errorCount,
      staleSyncCount: stale,
      lastSuccessfulSyncAt: lastSync?.lastSyncAt?.toISOString() ?? null,
      lastSyncChannel: lastSync?.channel ?? null,
      channels: ["TRENDYOL", "HEPSIBURADA"],
    },
    issues.length ? "marketplace-sync cron ve entegrasyon hata loglarını inceleyin." : null,
    issues
  );
}

async function checkEfaturamIntegrations(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  const activeWhere = {
    credentialsEncrypted: { not: null },
    status: { not: "DISCONNECTED" as const },
  };

  const [configured, connected, errorCount, lastSuccess] = await Promise.all([
    db.efaturamIntegration.count({ where: activeWhere }),
    db.efaturamIntegration.count({
      where: { ...activeWhere, status: "CONNECTED" },
    }),
    db.efaturamIntegration.count({
      where: { ...activeWhere, status: "ERROR" },
    }),
    db.efaturamIntegration.findFirst({
      where: { lastSuccessfulAt: { not: null }, ...activeWhere },
      orderBy: { lastSuccessfulAt: "desc" },
      select: { lastSuccessfulAt: true, provider: true },
    }),
  ]);

  if (configured === 0) {
    return makeResult(
      def,
      "NOT_CONFIGURED",
      "e-Fatura entegrasyonu yapılandırılmamış.",
      0,
      { configuredCompanyCount: 0, connectedCount: 0 },
      null,
      []
    );
  }

  const status: HealthCheckStatus = errorCount > 0 ? "DEGRADED" : "HEALTHY";

  return makeResult(
    def,
    status,
    errorCount > 0
      ? `${errorCount} aktif e-Fatura entegrasyonu hata durumunda.`
      : `${connected} bağlı, entegrasyonlar normal.`,
    0,
    {
      configuredCompanyCount: configured,
      connectedCount: connected,
      errorCount,
      lastSuccessfulAt: lastSuccess?.lastSuccessfulAt?.toISOString() ?? null,
      provider: lastSuccess?.provider ?? null,
    },
    errorCount > 0 ? "Efaturam/Sovos entegrasyon hatalarını inceleyin." : null
  );
}

async function checkCronJobs(def: HealthCheckDefinition): Promise<HealthCheckResult> {
  const isProduction = isProductionRuntime();
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim());

  const lastSuccessEntries = await Promise.all(
    JOB_REGISTRY.map(async (job) => {
      const last = await db.systemJobRun.findFirst({
        where: { jobKey: job.key, status: "SUCCEEDED" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      });
      return [job.key, last?.finishedAt ?? null] as const;
    })
  );
  const lastSuccessByKey = new Map(lastSuccessEntries);

  let exchangeRateStale = false;
  if (isProduction) {
    const exchangeJob = getJobDefinition("exchange-rates");
    const overdueMs = exchangeJob?.overdueAfterMs ?? 2 * 60 * 60 * 1000;
    const exchangeLast = await db.exchangeRateSnapshot.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    });
    exchangeRateStale =
      !exchangeLast?.fetchedAt ||
      Date.now() - exchangeLast.fetchedAt.getTime() > overdueMs;
  }

  const cronEval = evaluateCronHealth({
    cronSecretConfigured,
    isProduction,
    jobs: JOB_REGISTRY.map((job) => ({
      key: job.key,
      cronRoute: job.cronRoute,
      overdueAfterMs: job.overdueAfterMs,
    })),
    lastSuccessByKey,
    exchangeRateStale,
  });

  return makeResult(
    def,
    cronEval.status,
    cronEval.summary,
    0,
    cronEval.details,
    cronEval.suggestedAction,
    cronEval.issues as HealthIssueCode[]
  );
}

export async function countHealthErrorsLast24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.activityLog.count({
    where: {
      createdAt: { gte: since },
      OR: [
        { action: { contains: "FAIL", mode: "insensitive" } },
        { action: { contains: "ERROR", mode: "insensitive" } },
        { metadata: { path: ["success"], equals: false } },
      ],
    },
  });
}
