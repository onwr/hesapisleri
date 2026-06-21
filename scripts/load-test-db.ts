/**
 * Lightweight DB/API load smoke test.
 *
 * Usage:
 *   CONCURRENCY=20 BASE_URL=http://localhost:3000 CRON_SECRET=xxx npx tsx scripts/load-test-db.ts
 *
 * Defaults are conservative to avoid hammering production.
 */

type RequestResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  timedOut: boolean;
};

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? "20"));
const TIMEOUT_MS = Math.max(1000, Number(process.env.TIMEOUT_MS ?? "15000"));
const ENDPOINT = process.env.LOAD_TEST_ENDPOINT ?? "/api/health/db";
const SECRET = process.env.DB_HEALTH_SECRET ?? process.env.CRON_SECRET ?? "";

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1
  );
  return sorted[index];
}

async function fireRequest(): Promise<RequestResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${ENDPOINT}`, {
      method: "GET",
      headers: SECRET ? { authorization: `Bearer ${SECRET}` } : undefined,
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      timedOut: false,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error && error.name === "AbortError";

    return {
      ok: false,
      status: timedOut ? 504 : 0,
      latencyMs: Date.now() - startedAt,
      timedOut,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!SECRET && ENDPOINT.includes("/api/health/db")) {
    console.warn(
      "Uyarı: CRON_SECRET veya DB_HEALTH_SECRET tanımlı değil; health endpoint 401 dönebilir."
    );
  }

  console.log(`Load test: ${CONCURRENCY} concurrent -> ${BASE_URL}${ENDPOINT}`);

  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => fireRequest())
  );

  const latencies = results.map((item) => item.latencyMs);
  const successCount = results.filter((item) => item.ok).length;
  const failCount = results.length - successCount;
  const timeoutCount = results.filter((item) => item.timedOut).length;
  const avgLatency =
    latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1);

  console.log("");
  console.log(`Success: ${successCount}`);
  console.log(`Fail: ${failCount}`);
  console.log(`Timeouts: ${timeoutCount}`);
  console.log(`Avg latency: ${Math.round(avgLatency)} ms`);
  console.log(`P95 latency: ${percentile(latencies, 95)} ms`);

  const statusCounts = results.reduce<Record<number, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Status breakdown:", statusCounts);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("LOAD_TEST_DB_ERROR", error);
  process.exitCode = 1;
});
