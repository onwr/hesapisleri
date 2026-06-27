import v8 from "node:v8";
import type { HealthCheckStatus, HealthIssueCode } from "@/lib/admin/system-health/system-health-registry";

export type MemorySnapshot = {
  heapUsedMb: number;
  heapTotalMb: number;
  heapLimitMb: number;
  rssMb: number;
  heapLimitUsageRatio: number;
};

export function captureMemorySnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const heapLimitMb = Math.round(heapStats.heap_size_limit / 1024 / 1024);

  return {
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    heapLimitMb,
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapLimitUsageRatio:
      Math.round((mem.heapUsed / Math.max(heapStats.heap_size_limit, 1)) * 1000) / 1000,
  };
}

const HEAP_LIMIT_DEGRADED_RATIO = 0.9;

export function evaluateMemoryHealth(snapshot: MemorySnapshot, isProduction: boolean) {
  const issues: HealthIssueCode[] = [];
  let status: HealthCheckStatus = "HEALTHY";
  let summary = "Runtime bellek metrikleri normal.";

  if (isProduction && snapshot.heapLimitUsageRatio > HEAP_LIMIT_DEGRADED_RATIO) {
    status = "DEGRADED";
    issues.push("HIGH_MEMORY_USAGE");
    summary = "Heap limit kullanımı yüksek.";
  }

  return { status, summary, issues };
}
