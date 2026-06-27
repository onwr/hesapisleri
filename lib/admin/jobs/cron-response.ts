import type { SystemJobRun } from "@prisma/client";

type CronLegacyShape = "spread" | "data";

const CRON_LEGACY_SHAPE: Record<string, CronLegacyShape> = {
  "billing-outbox": "data",
  "billing-renewals": "data",
  "payment-reconciliation": "data",
  "marketplace-sync": "data",
  notifications: "spread",
  "employee-performance": "spread",
  "exchange-rates": "spread",
  "discount-reservations": "spread",
  "membership-campaign-lifecycle": "spread",
  "usage-period-reset": "spread",
};

function extractSafeMetadata(run: SystemJobRun): Record<string, unknown> {
  if (
    run.safeMetadata != null &&
    typeof run.safeMetadata === "object" &&
    !Array.isArray(run.safeMetadata)
  ) {
    return run.safeMetadata as Record<string, unknown>;
  }
  return run.summary ? { summary: run.summary } : {};
}

export function buildCronRouteResponse(jobKey: string, run: SystemJobRun) {
  const meta = extractSafeMetadata(run);
  const routeSuccess = run.status === "SUCCEEDED";
  const extensions = {
    runId: run.id,
    status: run.status,
  };

  const shape = CRON_LEGACY_SHAPE[jobKey] ?? "spread";

  if (shape === "data") {
    return {
      success: routeSuccess,
      data: meta,
      ...extensions,
    };
  }

  return {
    ...meta,
    success: routeSuccess,
    data: meta,
    ...extensions,
  };
}
