export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  return nodeEnv === "production" || appEnv === "production";
}

export type CronJobSchedule = {
  key: string;
  cronRoute: string;
  overdueAfterMs: number;
};

export type CronJobLastSuccess = {
  jobKey: string;
  finishedAt: Date | null;
};

export function evaluateCronHealth(input: {
  cronSecretConfigured: boolean;
  isProduction: boolean;
  jobs: CronJobSchedule[];
  lastSuccessByKey: Map<string, Date | null>;
  exchangeRateStale?: boolean;
}) {
  const registeredCronRoutes = input.jobs.map((job) => job.cronRoute);
  const issues: string[] = [];

  if (!input.cronSecretConfigured) {
    if (input.isProduction) {
      return {
        status: "DEGRADED" as const,
        summary: "CRON_SECRET tanımlı değil.",
        issues: [] as string[],
        details: {
          cronSecretConfigured: false,
          registeredCronRoutes,
          environment: input.isProduction ? "production" : "development",
          schedulerExpected: input.isProduction,
        },
        suggestedAction: "CRON_SECRET ortam değişkenini tanımlayın.",
      };
    }

    return {
      status: "NOT_CONFIGURED" as const,
      summary: "Geliştirme ortamında harici cron scheduler beklenmiyor.",
      issues: [] as string[],
      details: {
        cronSecretConfigured: false,
        registeredCronRoutes,
        environment: "development",
        schedulerExpected: false,
      },
      suggestedAction: null,
    };
  }

  const overdueJobs: string[] = [];
  const now = Date.now();

  if (input.isProduction) {
    for (const job of input.jobs) {
      const lastSuccess = input.lastSuccessByKey.get(job.key);
      if (!lastSuccess || now - lastSuccess.getTime() > job.overdueAfterMs) {
        overdueJobs.push(job.key);
      }
    }

    if (input.exchangeRateStale) {
      issues.push("CRON_OVERDUE");
    }
    if (overdueJobs.length > 0) {
      issues.push("CRON_OVERDUE");
    }
  }

  const hasOverdue = overdueJobs.length > 0 || Boolean(input.exchangeRateStale);

  return {
    status: hasOverdue && input.isProduction ? ("DEGRADED" as const) : ("HEALTHY" as const),
    summary:
      hasOverdue && input.isProduction
        ? `${overdueJobs.length || 1} cron job gecikmiş görünüyor.`
        : "Cron altyapısı yapılandırılmış.",
    issues,
    details: {
      cronSecretConfigured: true,
      registeredCronRoutes,
      overdueJobCount: overdueJobs.length,
      overdueJobs,
      exchangeRateStale: input.exchangeRateStale ?? false,
      environment: input.isProduction ? "production" : "development",
      schedulerExpected: input.isProduction,
    },
    suggestedAction:
      hasOverdue && input.isProduction
        ? "Zamanlanmış job çalışmalarını ve CRON_SECRET erişimini doğrulayın."
        : null,
  };
}

export function countStuckOutboxPending(
  pendingRows: Array<{ availableAt: Date }>,
  now: Date,
  stuckAfterMs: number
) {
  const stuckBefore = new Date(now.getTime() - stuckAfterMs);
  return pendingRows.filter((row) => row.availableAt.getTime() < stuckBefore.getTime()).length;
}
