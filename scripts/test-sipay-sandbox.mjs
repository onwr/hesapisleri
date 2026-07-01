/**
 * Sipay sandbox smoke — opt-in only.
 *   SIPAY_SANDBOX_TEST=1 npm run test:sipay-sandbox
 *   SIPAY_SANDBOX_TEST=1 npm run test:sipay-sandbox -- --check <invoice-id>
 *   SIPAY_SANDBOX_TEST=1 SIPAY_SANDBOX_REFUND=1 npm run test:sipay-sandbox -- --refund <invoice-id> <amount>
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const extraArgs = process.argv.slice(2);

function skip(message) {
  console.log(`[SIPAY-SANDBOX] SKIP: ${message}`);
  process.exit(0);
}

if (process.env.SIPAY_SANDBOX_TEST !== "1") {
  skip("SIPAY_SANDBOX_TEST=1 olmadan dış ağa çıkılmaz.");
}

const sipayEnv = (process.env.SIPAY_ENV ?? "test").toLowerCase();
if (sipayEnv !== "test") skip("Yalnızca SIPAY_ENV=test desteklenir.");

const baseUrl = process.env.SIPAY_BASE_URL ?? "https://provisioning.sipay.com.tr";
if (baseUrl.includes("app.sipay.com.tr")) skip("Live Sipay URL reddedildi.");

const required = [
  "SIPAY_APP_ID",
  "SIPAY_APP_SECRET",
  "SIPAY_MERCHANT_KEY",
  "SIPAY_MERCHANT_ID",
];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length > 0) skip(`Sandbox credential eksik: ${missing.join(", ")}`);
if (process.env.SIPAY_ENABLED !== "true") skip("SIPAY_ENABLED=true değil.");

if (extraArgs[0] === "--refund" && process.env.SIPAY_SANDBOX_REFUND !== "1") {
  skip("Refund için SIPAY_SANDBOX_REFUND=1 gerekli.");
}

const child = spawn(
  process.execPath,
  ["--import", "tsx/esm", join(__dirname, "run-sipay-sandbox.mjs"), ...extraArgs],
  {
    cwd: webRoot,
    stdio: "inherit",
    env: { ...process.env, SIPAY_SANDBOX_TEST: "1" },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
