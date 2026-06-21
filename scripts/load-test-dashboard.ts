/**
 * Dashboard cache smoke / latency comparison.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 CONCURRENCY=10 npx tsx scripts/load-test-dashboard.ts
 *
 * Requires authenticated session cookie or internal health secret is not enough for /dashboard HTML.
 * This script measures /dashboard HTML response latency (cache benefits server-side Prisma layer).
 */

type RequestResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  timedOut: boolean;
};

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? "10"));
const REPEAT = Math.max(1, Number(process.env.REPEAT ?? "3"));
const TIMEOUT_MS = Math.max(1000, Number(process.env.TIMEOUT_MS ?? "30000"));
const COOKIE = process.env.LOAD_TEST_COOKIE ?? "";

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1
  );
  return sorted[index];
}

async function fetchDashboard(): Promise<RequestResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/dashboard`, {
      method: "GET",
      headers: COOKIE ? { cookie: COOKIE } : undefined,
      signal: controller.signal,
      redirect: "manual",
    });

    return {
      ok: response.ok || response.status === 307 || response.status === 302,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      timedOut: false,
    };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error && error.name === "AbortError" ? 504 : 0,
      latencyMs: Date.now() - startedAt,
      timedOut: error instanceof Error && error.name === "AbortError",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!COOKIE) {
    console.warn(
      "Uyarı: LOAD_TEST_COOKIE tanımlı değil; /dashboard login redirect dönebilir."
    );
  }

  console.log(
    `Dashboard load test: ${CONCURRENCY} concurrent x ${REPEAT} rounds -> ${BASE_URL}/dashboard`
  );

  const allResults: RequestResult[] = [];

  for (let round = 1; round <= REPEAT; round += 1) {
    const batch = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => fetchDashboard())
    );
    allResults.push(...batch);
    console.log(
      `Round ${round}: avg ${Math.round(batch.reduce((s, r) => s + r.latencyMs, 0) / batch.length)} ms`
    );
  }

  const latencies = allResults.map((item) => item.latencyMs);
  const successCount = allResults.filter((item) => item.ok).length;

  console.log("");
  console.log(`Success: ${successCount}/${allResults.length}`);
  console.log(`Fail: ${allResults.length - successCount}`);
  console.log(`Timeouts: ${allResults.filter((item) => item.timedOut).length}`);
  console.log(`First request: ${latencies[0] ?? 0} ms`);
  console.log(`Avg latency: ${Math.round(latencies.reduce((a, b) => a + b, 0) / Math.max(latencies.length, 1))} ms`);
  console.log(`P50: ${percentile(latencies, 50)} ms`);
  console.log(`P95: ${percentile(latencies, 95)} ms`);

  if (successCount < allResults.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("LOAD_TEST_DASHBOARD_ERROR", error);
  process.exitCode = 1;
});
