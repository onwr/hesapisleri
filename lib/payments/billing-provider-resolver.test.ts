import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it, beforeEach, afterEach } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getActiveBillingProvider,
  getBillingPaymentProvider,
  isSipayCheckoutActive,
  isPaytrCheckoutActive,
  normalizeBillingPaymentProvider,
  resolveBillingPaymentProviderRaw,
  validateBillingProviderConfig,
  _resetBillingProviderWarnings,
} from "./billing-provider-resolver";

const ORIGINAL = { ...process.env };
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL);
  _resetBillingProviderWarnings();
}

function runResolverInSubprocess(envPatch: Record<string, string | null>) {
  const env = { ...ORIGINAL };
  for (const [key, value] of Object.entries(envPatch)) {
    if (value === null) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/check-billing-provider-env.mjs"],
    { cwd: webRoot, encoding: "utf8", env },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "subprocess failed");
  }

  return JSON.parse(result.stdout.trim()) as Record<string, unknown>;
}

describe("billing-provider-resolver", () => {
  beforeEach(() => {
    process.env.BILLING_PAYMENT_PROVIDER = "PAYTR";
    process.env.SIPAY_ENABLED = "false";
    process.env.PAYTR_ENABLED = "true";
    _resetBillingProviderWarnings();
  });

  afterEach(restoreEnv);

  it("BILLING_PAYMENT_PROVIDER eksik + SIPAY_ENABLED → SIPAY fallback", () => {
    delete process.env.BILLING_PAYMENT_PROVIDER;
    process.env.SIPAY_ENABLED = "true";
    assert.equal(resolveBillingPaymentProviderRaw(), "SIPAY");
    assert.equal(getActiveBillingProvider(), "SIPAY");
    assert.equal(isSipayCheckoutActive(), true);
    assert.equal(isPaytrCheckoutActive(), false);
  });

  it("BILLING_PAYMENT_PROVIDER eksik + SIPAY kapalı → PAYTR fallback", () => {
    delete process.env.BILLING_PAYMENT_PROVIDER;
    process.env.SIPAY_ENABLED = "false";
    assert.equal(resolveBillingPaymentProviderRaw(), "PAYTR");
    assert.equal(getActiveBillingProvider(), "PAYTR");
    assert.equal(isPaytrCheckoutActive(), true);
    assert.equal(isSipayCheckoutActive(), false);
  });

  it("BILLING_PAYMENT_PROVIDER eksik → production error", () => {
    const out = runResolverInSubprocess({
      NODE_ENV: "production",
      BILLING_PAYMENT_PROVIDER: null,
      SIPAY_ENABLED: "false",
      PAYTR_ENABLED: "true",
    });
    assert.equal(out.ok, false);
    assert.match(String(out.error), /BILLING_PAYMENT_PROVIDER tanımlı değil/);
  });

  it("provider adı büyük/küçük harf normalize", () => {
    assert.equal(normalizeBillingPaymentProvider("sipay"), "SIPAY");
    assert.equal(normalizeBillingPaymentProvider("  PayTr  "), "PAYTR");
    process.env.BILLING_PAYMENT_PROVIDER = "sipay";
    process.env.SIPAY_ENABLED = "true";
    assert.equal(getBillingPaymentProvider().provider, "SIPAY");
  });

  it("SIPAY seçili + enabled → SIPAY", () => {
    process.env.BILLING_PAYMENT_PROVIDER = "SIPAY";
    process.env.SIPAY_ENABLED = "true";
    const info = getBillingPaymentProvider();
    assert.equal(info.provider, "SIPAY");
    assert.equal(info.sipayEnabled, true);
    assert.equal(isSipayCheckoutActive(), true);
    assert.equal(isPaytrCheckoutActive(), false);
    assert.doesNotThrow(() => validateBillingProviderConfig());
  });

  it("PAYTR seçili + enabled → PAYTR", () => {
    process.env.BILLING_PAYMENT_PROVIDER = "PAYTR";
    process.env.PAYTR_ENABLED = "true";
    const info = getBillingPaymentProvider();
    assert.equal(info.provider, "PAYTR");
    assert.equal(info.paytrEnabled, true);
    assert.equal(isPaytrCheckoutActive(), true);
    assert.equal(isSipayCheckoutActive(), false);
    assert.doesNotThrow(() => validateBillingProviderConfig());
  });

  it("SIPAY seçili ama disabled → config error", () => {
    process.env.BILLING_PAYMENT_PROVIDER = "SIPAY";
    process.env.SIPAY_ENABLED = "false";
    assert.throws(() => validateBillingProviderConfig(), /SIPAY_ENABLED/);
    assert.throws(() => getBillingPaymentProvider(), /SIPAY_ENABLED/);
  });

  it("PAYTR seçili ama PAYTR_ENABLED=false → config error", () => {
    process.env.BILLING_PAYMENT_PROVIDER = "PAYTR";
    process.env.PAYTR_ENABLED = "false";
    assert.throws(() => validateBillingProviderConfig(), /PAYTR_ENABLED/);
    assert.throws(() => getBillingPaymentProvider(), /PAYTR_ENABLED/);
  });

  it("geçersiz provider adı → error", () => {
    assert.throws(
      () => normalizeBillingPaymentProvider("stripe"),
      /Geçersiz BILLING_PAYMENT_PROVIDER/,
    );
  });
});
