import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("exchange rate infrastructure", () => {
  it("cron route uses CRON_SECRET", () => {
    const source = read("app/api/cron/exchange-rates/route.ts");
    assert.match(source, /CRON_SECRET/);
    assert.match(source, /fetchAndStoreExchangeRatesForWindow/);
  });

  it("dashboard service reads snapshots only", () => {
    const source = read("lib/exchange-rate-service.ts");
    assert.match(source, /getDashboardExchangeRates/);
    assert.match(source, /exchangeRateSnapshot/);

    const fnMatch = source.match(
      /export async function getDashboardExchangeRates\([\s\S]*?\n\}/
    );
    assert.ok(fnMatch, "getDashboardExchangeRates function not found");
    const fnBody = fnMatch[0];
    assert.doesNotMatch(fnBody, /fetchExternalExchangeRates/);
    assert.doesNotMatch(fnBody, /open\.er-api\.com/);
  });

  it("dashboard widget does not poll externally", () => {
    const source = read("components/dashboard/dashboard-exchange-rates.tsx");
    assert.doesNotMatch(source, /fetch\(/);
    assert.doesNotMatch(source, /setInterval/);
  });
});
