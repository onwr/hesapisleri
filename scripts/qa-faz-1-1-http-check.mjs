import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.QA_HTTP_PORT ?? "3099";
const baseUrl = `http://127.0.0.1:${port}`;
const standaloneDir = join(webRoot, ".next", "standalone");
const serverEntry = join(standaloneDir, "server.js");

if (!existsSync(serverEntry)) {
  console.error("Missing standalone server.js — run next build first");
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: port,
  HOSTNAME: "127.0.0.1",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:kurkaya1234@127.0.0.1:5432/hesapisleri_test",
  BILLING_PAYMENT_PROVIDER: process.env.BILLING_PAYMENT_PROVIDER ?? "PAYTR",
  PAYTR_ENABLED: process.env.PAYTR_ENABLED ?? "true",
  PAYTR_MERCHANT_ID: process.env.PAYTR_MERCHANT_ID ?? "smoke-merchant",
  PAYTR_MERCHANT_KEY: process.env.PAYTR_MERCHANT_KEY ?? "smoke-merchant-key",
  PAYTR_MERCHANT_SALT: process.env.PAYTR_MERCHANT_SALT ?? "smoke-merchant-salt",
  SIPAY_ENABLED: process.env.SIPAY_ENABLED ?? "false",
};

const server = spawn(process.execPath, [serverEntry], {
  cwd: standaloneDir,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout?.on("data", (chunk) => {
  serverLog += String(chunk);
});
server.stderr?.on("data", (chunk) => {
  serverLog += String(chunk);
});

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`${baseUrl}/`);
      if (res.ok || res.status === 307 || res.status === 308) return;
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error(`Server did not start on ${baseUrl}\n${serverLog}`);
}

async function assertStatus(path, expected) {
  const res = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  if (res.status !== expected) {
    throw new Error(`${path} expected ${expected} got ${res.status}`);
  }
  return res;
}

try {
  await waitForServer();

  const robots = await assertStatus("/robots.txt", 200);
  const robotsText = await robots.text();
  if (!robotsText.includes("Disallow") && !robotsText.includes("disallow")) {
    throw new Error("robots.txt empty or invalid");
  }
  if (!robotsText.includes("/cash-bank") || !robotsText.includes("/login")) {
    throw new Error("robots.txt missing protected disallow rules");
  }

  const sitemap = await assertStatus("/sitemap.xml", 200);
  const sitemapText = await sitemap.text();
  if (!sitemapText.includes("<urlset")) {
    throw new Error("sitemap.xml invalid");
  }
  if (sitemapText.includes("/cash-bank") || sitemapText.includes("/login")) {
    throw new Error("private routes must not be in sitemap");
  }

  const notFound = await assertStatus("/this-route-does-not-exist-qa-faz11", 404);
  const notFoundHtml = await notFound.text();
  if (
    !notFoundHtml.includes("Sayfa bulunamadı") &&
    !notFoundHtml.includes("bulunamadı") &&
    !/not\s*found/i.test(notFoundHtml)
  ) {
    throw new Error("404 page missing expected not-found content");
  }

  const login = await fetch(new URL("/login", baseUrl), { redirect: "manual" });
  if (!login.ok && login.status !== 307) {
    throw new Error(`/login expected 200/307 got ${login.status}`);
  }

  const home = await fetch(new URL("/", baseUrl));
  const csp = home.headers.get("content-security-policy");
  const xcto = home.headers.get("x-content-type-options");
  if (!csp?.includes("default-src")) throw new Error("missing CSP on /");
  if (xcto !== "nosniff") throw new Error("missing nosniff on /");

  console.log("QA Faz 1.1 HTTP checks passed");
} finally {
  server.kill("SIGTERM");
  await delay(300);
}
