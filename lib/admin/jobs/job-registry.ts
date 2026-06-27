import "server-only";

import { processBillingOutboxBatch } from "@/lib/billing/billing-outbox-service";
import { cleanupExpiredReservations } from "@/lib/billing/discount-reservation-service";
import { runBillingRenewals } from "@/lib/billing/subscription-renewal-service";
import { resetExpiredUsagePeriods } from "@/lib/billing/usage/usage-period-service";
import { runMembershipCampaignLifecycle } from "@/lib/admin/promotions/campaign-lifecycle-service";
import { runEmployeePerformanceSnapshotCron } from "@/lib/employee-performance-cron-service";
import { fetchAndStoreExchangeRatesForWindow } from "@/lib/exchange-rate-service";
import { getExchangeWindowKey } from "@/lib/exchange-rate-utils";
import { runMarketplaceSyncCron } from "@/lib/marketplace/marketplace-sync-cron-service";
import { runProactiveNotificationCron } from "@/lib/notification-cron-service";
import { runPaymentReconciliation } from "@/lib/payments/payment-reconciliation-service";
import type { JobDefinition } from "@/lib/admin/jobs/job-types";

const HOUR = 60 * 60 * 1000;

export const JOB_REGISTRY: JobDefinition[] = [
  {
    key: "billing-outbox",
    label: "Billing Outbox",
    category: "billing",
    description: "Bekleyen billing outbox olaylarını işler.",
    scheduleHint: "Her 5 dakika",
    criticality: "critical",
    timeoutMs: 120_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: true,
    cronRoute: "/api/cron/billing-outbox",
    overdueAfterMs: 15 * 60 * 1000,
    handler: () => processBillingOutboxBatch(),
  },
  {
    key: "billing-renewals",
    label: "Abonelik Yenileme",
    category: "billing",
    description: "Otomatik abonelik yenileme ve tahsilat akışı.",
    scheduleHint: "Günlük",
    criticality: "critical",
    timeoutMs: 300_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: false,
    cronRoute: "/api/cron/billing-renewals",
    overdueAfterMs: 26 * HOUR,
    handler: () => runBillingRenewals(),
  },
  {
    key: "payment-reconciliation",
    label: "Ödeme Mutabakatı",
    category: "payment",
    description: "Bekleyen PayTR ödemelerini sağlayıcı ile mutabık eder.",
    scheduleHint: "Her 15 dakika",
    criticality: "critical",
    timeoutMs: 180_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: false,
    cronRoute: "/api/cron/payment-reconciliation",
    overdueAfterMs: 30 * 60 * 1000,
    handler: () => runPaymentReconciliation(),
  },
  {
    key: "exchange-rates",
    label: "Döviz Kurları",
    category: "integrations",
    description: "Güncel döviz kurlarını çeker ve kaydeder.",
    scheduleHint: "Saatlik",
    criticality: "normal",
    timeoutMs: 60_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: true,
    cronRoute: "/api/cron/exchange-rates",
    overdueAfterMs: 2 * HOUR,
    handler: async () => {
      const windowKey = getExchangeWindowKey();
      const snapshot = await fetchAndStoreExchangeRatesForWindow(windowKey);
      return {
        windowKey,
        fetchedAt: snapshot.fetchedAt.toISOString(),
        source: snapshot.source,
        rates: snapshot.rates,
        rateCount: Object.keys(snapshot.rates as object).length,
      };
    },
  },
  {
    key: "notifications",
    label: "Proaktif Bildirimler",
    category: "notifications",
    description: "Zamanlanmış proaktif bildirimleri oluşturur.",
    scheduleHint: "Her 15 dakika",
    criticality: "normal",
    timeoutMs: 120_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: true,
    cronRoute: "/api/cron/notifications",
    overdueAfterMs: 30 * 60 * 1000,
    handler: () => runProactiveNotificationCron(),
  },
  {
    key: "employee-performance",
    label: "Performans Snapshot",
    category: "operations",
    description: "Personel performans snapshot verilerini günceller.",
    scheduleHint: "Günlük",
    criticality: "normal",
    timeoutMs: 180_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: true,
    cronRoute: "/api/cron/employee-performance",
    overdueAfterMs: 26 * HOUR,
    handler: () => runEmployeePerformanceSnapshotCron(),
  },
  {
    key: "marketplace-sync",
    label: "Pazaryeri Senkronizasyonu",
    category: "integrations",
    description: "Bağlı pazaryeri entegrasyonlarını senkronize eder.",
    scheduleHint: "Her 15 dakika",
    criticality: "normal",
    timeoutMs: 300_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: true,
    cronRoute: "/api/cron/marketplace-sync",
    overdueAfterMs: 30 * 60 * 1000,
    handler: () => runMarketplaceSyncCron(),
  },
  {
    key: "membership-campaign-lifecycle",
    label: "Kampanya Yaşam Döngüsü",
    category: "promotions",
    description: "Kampanya başlangıç/bitiş durumlarını günceller.",
    scheduleHint: "Saatlik",
    criticality: "normal",
    timeoutMs: 120_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: true,
    cronRoute: "/api/cron/membership-campaign-lifecycle",
    overdueAfterMs: 2 * HOUR,
    handler: () => runMembershipCampaignLifecycle(),
  },
  {
    key: "discount-reservations",
    label: "İndirim Rezervasyon Temizliği",
    category: "promotions",
    description: "Süresi dolmuş indirim rezervasyonlarını temizler.",
    scheduleHint: "Her 10 dakika",
    criticality: "normal",
    timeoutMs: 60_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: true,
    cronRoute: "/api/cron/discount-reservations",
    overdueAfterMs: 20 * 60 * 1000,
    handler: () => cleanupExpiredReservations(),
  },
  {
    key: "usage-period-reset",
    label: "Kullanım Dönemi Sıfırlama",
    category: "billing",
    description: "Süresi dolan kullanım dönemlerini sıfırlar.",
    scheduleHint: "Günlük",
    criticality: "normal",
    timeoutMs: 120_000,
    concurrencyPolicy: "exclusive",
    manualRunSupported: true,
    cronRoute: "/api/cron/usage-period-reset",
    overdueAfterMs: 26 * HOUR,
    handler: () => resetExpiredUsagePeriods(),
  },
];

export const JOB_REGISTRY_MAP = new Map(JOB_REGISTRY.map((j) => [j.key, j]));

export function getJobDefinition(jobKey: string): JobDefinition | undefined {
  return JOB_REGISTRY_MAP.get(jobKey);
}

export function assertJobDefinition(jobKey: string): JobDefinition {
  const job = getJobDefinition(jobKey);
  if (!job) {
    throw new Error("Bilinmeyen job.");
  }
  return job;
}
