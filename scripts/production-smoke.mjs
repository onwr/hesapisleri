#!/usr/bin/env node

const DEFAULT_BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const WRITE_SMOKE = process.env.SMOKE_WRITE === "1";
const IS_PRODUCTION_TARGET =
  /hesapisleri\.com/i.test(DEFAULT_BASE) || process.env.APP_ENV === "production";

async function check(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function fetchJson(path, init) {
  const res = await fetch(new URL(path, DEFAULT_BASE), init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { res, body, text };
}

async function main() {
  console.log("Production smoke — read-only", DEFAULT_BASE);

  if (WRITE_SMOKE && IS_PRODUCTION_TARGET) {
    console.error("Write smoke production hedefinde kapalı.");
    process.exit(2);
  }

  const results = [];

  results.push(
    await check("app reachable", async () => {
      const { res } = await fetchJson("/");
      if (!res.ok && res.status !== 307 && res.status !== 308) {
        throw new Error(`status ${res.status}`);
      }
    })
  );

  results.push(
    await check("health live", async () => {
      const { res, body } = await fetchJson("/api/health/live");
      if (!res.ok || !body.ok) throw new Error(`status ${res.status}`);
    })
  );

  results.push(
    await check("health ready", async () => {
      const { res, body } = await fetchJson("/api/health/ready");
      if (!res.ok || !body.ok) throw new Error(`status ${res.status}`);
      if (JSON.stringify(body).includes("DATABASE_URL")) {
        throw new Error("secret leak");
      }
    })
  );

  results.push(
    await check("login page", async () => {
      const { res } = await fetchJson("/login");
      if (!res.ok) throw new Error(`status ${res.status}`);
    })
  );

  results.push(
    await check("tenant API unauthenticated rejection", async () => {
      const { res } = await fetchJson("/api/products/list");
      if (res.status !== 401 && res.status !== 403) {
        throw new Error(`expected 401/403 got ${res.status}`);
      }
    })
  );

  results.push(
    await check("cron without secret rejected", async () => {
      const { res } = await fetchJson("/api/cron/notifications");
      if (res.status !== 401 && res.status !== 403) {
        throw new Error(`expected 401/403 got ${res.status}`);
      }
    })
  );

  results.push(
    await check("admin route protected", async () => {
      const { res } = await fetchJson("/api/admin/system-health");
      if (res.status !== 401 && res.status !== 403) {
        throw new Error(`expected 401/403 got ${res.status}`);
      }
    })
  );

  results.push(
    await check("maintenance route", async () => {
      const { res } = await fetchJson("/maintenance");
      if (!res.ok && res.status !== 307) throw new Error(`status ${res.status}`);
    })
  );

  results.push(
    await check("security headers", async () => {
      const res = await fetch(new URL("/", DEFAULT_BASE));
      const xcto = res.headers.get("x-content-type-options");
      if (xcto !== "nosniff") throw new Error("missing nosniff");
      const body = await res.text();
      if (body.includes("PAYTR_MERCHANT_KEY") || body.includes("DATABASE_URL")) {
        throw new Error("secret exposure in HTML");
      }
    })
  );

  if (WRITE_SMOKE) {
    console.log("Write smoke enabled — staging/test only");
  }

  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) process.exit(1);
  console.log("All smoke checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
