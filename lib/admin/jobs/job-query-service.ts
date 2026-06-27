import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/prisma";
import { buildStructuredJobActivityWhere } from "@/lib/admin/jobs/job-audit-service";
import { redactJobMetadata } from "@/lib/admin/jobs/job-privacy";
import { JOB_REGISTRY, getJobDefinition } from "@/lib/admin/jobs/job-registry";
import { JOB_CATEGORY_LABELS } from "@/lib/admin/jobs/job-types";

export type JobListFilters = {
  q?: string;
  category?: string;
  status?: string;
  page: number;
  pageSize: number;
};

const PAGE_SIZES = [25, 50, 100] as const;

export function parseJobListFilters(
  params: Record<string, string | string[] | undefined>
): JobListFilters {
  const rawPage = Number(params.page ?? 1);
  const rawSize = Number(params.pageSize ?? 25);
  return {
    q: typeof params.q === "string" && params.q.trim().length >= 2 ? params.q.trim() : undefined,
    category: typeof params.category === "string" && params.category !== "ALL" ? params.category : undefined,
    status: typeof params.status === "string" && params.status !== "ALL" ? params.status : undefined,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAGE_SIZES.includes(rawSize as (typeof PAGE_SIZES)[number]) ? rawSize : 25,
  };
}

type RunRow = {
  id: string;
  status: string;
  trigger: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  summary: string | null;
  errorCode: string | null;
  triggeredByUser: { id: string; name: string | null; email: string } | null;
};

async function loadLatestRuns() {
  const keys = JOB_REGISTRY.map((j) => j.key);
  const entries = await Promise.all(
    keys.map(async (jobKey) => {
      const [last, lastSuccess, lastFailed, running] = await Promise.all([
        db.systemJobRun.findFirst({
          where: { jobKey },
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            status: true,
            trigger: true,
            startedAt: true,
            finishedAt: true,
            durationMs: true,
            summary: true,
            errorCode: true,
            triggeredByUser: { select: { id: true, name: true, email: true } },
          },
        }),
        db.systemJobRun.findFirst({
          where: { jobKey, status: "SUCCEEDED" },
          orderBy: { finishedAt: "desc" },
          select: { finishedAt: true, durationMs: true },
        }),
        db.systemJobRun.findFirst({
          where: { jobKey, status: { in: ["FAILED", "TIMED_OUT"] } },
          orderBy: { finishedAt: "desc" },
          select: { finishedAt: true, errorCode: true },
        }),
        db.systemJobRun.findFirst({
          where: { jobKey, status: "RUNNING" },
          select: { id: true, startedAt: true },
        }),
      ]);
      return { jobKey, last, lastSuccess, lastFailed, running };
    })
  );
  return new Map(entries.map((e) => [e.jobKey, e]));
}

function deriveJobStatus(
  jobKey: string,
  last: RunRow | null,
  running: { id: string; startedAt: Date | null } | null,
  overdueAfterMs: number
) {
  if (running) return "RUNNING";
  if (!last) return "NEVER_RUN";
  if (last.status === "FAILED" || last.status === "TIMED_OUT") return "FAILED";
  const ref = last.finishedAt ?? last.startedAt;
  if (ref && Date.now() - ref.getTime() > overdueAfterMs) return "OVERDUE";
  if (last.status === "SUCCEEDED") return "HEALTHY";
  return "UNKNOWN";
}

function serializeRun(row: RunRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    trigger: row.trigger,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    summary: row.summary,
    errorCode: row.errorCode,
    triggeredBy: row.triggeredByUser
      ? { id: row.triggeredByUser.id, name: row.triggeredByUser.name, email: row.triggeredByUser.email }
      : null,
  };
}

async function buildJobListData() {
  const runMap = await loadLatestRuns();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failures24h = await db.systemJobRun.count({
    where: {
      status: { in: ["FAILED", "TIMED_OUT"] },
      startedAt: { gte: since24h },
    },
  });

  const items = JOB_REGISTRY.map((job) => {
    const data = runMap.get(job.key);
    const currentStatus = deriveJobStatus(
      job.key,
      data?.last ?? null,
      data?.running ?? null,
      job.overdueAfterMs
    );

    return {
      key: job.key,
      label: job.label,
      category: job.category,
      categoryLabel: JOB_CATEGORY_LABELS[job.category],
      description: job.description,
      scheduleHint: job.scheduleHint,
      criticality: job.criticality,
      manualRunSupported: job.manualRunSupported,
      cronRoute: job.cronRoute,
      currentStatus,
      isOverdue: currentStatus === "OVERDUE",
      isRunning: currentStatus === "RUNNING",
      lastRun: serializeRun(data?.last ?? null),
      lastSuccessAt: data?.lastSuccess?.finishedAt?.toISOString() ?? null,
      lastFailureAt: data?.lastFailed?.finishedAt?.toISOString() ?? null,
      lastDurationMs: data?.last?.durationMs ?? null,
    };
  });

  const metrics = {
    total: items.length,
    healthy: items.filter((i) => i.currentStatus === "HEALTHY").length,
    overdue: items.filter((i) => i.currentStatus === "OVERDUE").length,
    running: items.filter((i) => i.currentStatus === "RUNNING").length,
    failed: items.filter((i) => i.currentStatus === "FAILED").length,
    neverRun: items.filter((i) => i.currentStatus === "NEVER_RUN").length,
    failuresLast24h: failures24h,
  };

  return { items, metrics };
}

const getCachedJobList = unstable_cache(
  async () => buildJobListData(),
  ["admin-jobs-list"],
  { revalidate: 20, tags: ["admin-jobs"] }
);

export async function listAdminJobs(filters: JobListFilters) {
  const { items: all, metrics } = await getCachedJobList();

  let filtered = all;
  if (filters.q) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.key.toLowerCase().includes(q) ||
        i.label.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
    );
  }
  if (filters.category) {
    filtered = filtered.filter((i) => i.category === filters.category);
  }
  if (filters.status) {
    filtered = filtered.filter((i) => i.currentStatus === filters.status);
  }

  const total = filtered.length;
  const skip = (filters.page - 1) * filters.pageSize;
  const items = filtered.slice(skip, skip + filters.pageSize);

  return {
    items,
    metrics,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  };
}

export async function getAdminJobDetail(jobKey: string) {
  const job = getJobDefinition(jobKey);
  if (!job) return null;

  const list = await getCachedJobList();
  const item = list.items.find((i) => i.key === jobKey);
  if (!item) return null;

  return {
    ...item,
    timeoutMs: job.timeoutMs,
    concurrencyPolicy: job.concurrencyPolicy,
    suggestedAction:
      item.currentStatus === "FAILED"
        ? "Son hata kaydını inceleyin ve gerekirse manuel çalıştırın."
        : item.currentStatus === "OVERDUE"
          ? "Cron scheduler ve CRON_SECRET yapılandırmasını doğrulayın."
          : null,
  };
}

export async function listAdminJobRuns(jobKey: string, page = 1, pageSize = 25) {
  if (!getJobDefinition(jobKey)) return null;

  const skip = (page - 1) * pageSize;
  const [total, rows] = await Promise.all([
    db.systemJobRun.count({ where: { jobKey } }),
    db.systemJobRun.findMany({
      where: { jobKey },
      orderBy: { startedAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        status: true,
        trigger: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        summary: true,
        errorCode: true,
        safeMetadata: true,
        triggeredByUser: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      trigger: row.trigger,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      durationMs: row.durationMs,
      summary: row.summary,
      errorCode: row.errorCode,
      safeMetadata: redactJobMetadata(row.safeMetadata) as Record<string, unknown> | null,
      triggeredBy: row.triggeredByUser
        ? { id: row.triggeredByUser.id, name: row.triggeredByUser.name, email: row.triggeredByUser.email }
        : null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function listAdminJobActivity(jobKey: string, limit = 20) {
  if (!getJobDefinition(jobKey)) return null;

  const rows = await db.activityLog.findMany({
    where: buildStructuredJobActivityWhere(jobKey),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    user: row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : null,
    metadata: redactJobMetadata(row.metadata) as Record<string, unknown> | null,
  }));
}
