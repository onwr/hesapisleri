export type JobCategory =
  | "billing"
  | "payment"
  | "notifications"
  | "integrations"
  | "promotions"
  | "operations";

export type JobCriticality = "critical" | "normal";

export type JobConcurrencyPolicy = "exclusive";

export type JobHandler = () => Promise<unknown>;

export type JobDefinition = {
  key: string;
  label: string;
  category: JobCategory;
  description: string;
  scheduleHint: string;
  criticality: JobCriticality;
  timeoutMs: number;
  concurrencyPolicy: JobConcurrencyPolicy;
  manualRunSupported: boolean;
  cronRoute: string;
  overdueAfterMs: number;
  handler: JobHandler;
};

export const MANUAL_RUN_COOLDOWN_MS = 30_000;

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  billing: "Billing",
  payment: "Ödeme",
  notifications: "Bildirimler",
  integrations: "Entegrasyonlar",
  promotions: "Promosyonlar",
  operations: "Operasyon",
};
