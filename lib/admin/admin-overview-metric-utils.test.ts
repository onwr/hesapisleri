import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMetric,
  formatCurrencyTotals,
  subscriptionToMonthlyMinor,
  sumCurrencyAmounts,
} from "@/lib/admin/admin-overview-metric-utils";
import { summarizeMembershipPaymentError } from "@/lib/admin/admin-overview-payment-labels";

describe("buildMetric", () => {
  it("calculates change percent against previous period", () => {
    const metric = buildMetric({
      key: "companies_active",
      group: "companies",
      label: "Aktif firma",
      description: "test",
      value: 120,
      previousValue: 100,
      href: "/admin/companies?status=active",
    });

    assert.equal(metric.changeValue, 20);
    assert.equal(metric.changePercent, 20);
    assert.equal(metric.formattedValue, "120");
  });

  it("formats money metrics", () => {
    const metric = buildMetric({
      key: "revenue_collected",
      group: "revenue",
      label: "Tahsilat",
      description: "test",
      value: 1500,
      previousValue: 1000,
      format: "money",
      href: "/admin/payments?status=PAID",
    });

    assert.match(metric.formattedValue, /1\.500/);
  });
});

describe("subscriptionToMonthlyMinor", () => {
  it("uses monthly equivalent when available", () => {
    assert.equal(
      subscriptionToMonthlyMinor({
        billingInterval: "YEARLY",
        lockedPriceMinor: 120000,
        monthlyEquivalentMinor: 10000,
      }),
      10000
    );
  });

  it("divides yearly locked price by 12", () => {
    assert.equal(
      subscriptionToMonthlyMinor({
        billingInterval: "YEARLY",
        lockedPriceMinor: 120000,
        monthlyEquivalentMinor: null,
      }),
      10000
    );
  });
});

describe("sumCurrencyAmounts", () => {
  it("keeps currencies separate instead of merging", () => {
    const totals = sumCurrencyAmounts([
      { currency: "TRY", amount: 100 },
      { currency: "USD", amount: 50 },
      { currency: "TRY", amount: 25 },
    ]);

    assert.equal(totals.length, 2);
    const tryTotal = totals.find((item) => item.currency === "TRY");
    const usdTotal = totals.find((item) => item.currency === "USD");
    assert.equal(tryTotal?.amount, 125);
    assert.equal(usdTotal?.amount, 50);
  });

  it("formats multi-currency totals distinctly", () => {
    const formatted = formatCurrencyTotals([
      { currency: "TRY", amount: 100 },
      { currency: "USD", amount: 50 },
    ]);
    assert.match(formatted, /TRY|₺|100/);
    assert.match(formatted, /USD|50/);
  });
});

describe("summarizeMembershipPaymentError", () => {
  it("returns safe Turkish summaries without raw provider payload", () => {
    const summary = summarizeMembershipPaymentError({
      status: "FAILED",
      failedReasonCode: "insufficient_funds",
      failedReasonMessage: "RAW_PROVIDER_JSON_SHOULD_NOT_LEAK",
    });
    assert.equal(summary, "Yetersiz bakiye veya kart limiti");
    assert.doesNotMatch(summary, /RAW_PROVIDER/);
  });

  it("maps callback wait states", () => {
    const summary = summarizeMembershipPaymentError({ status: "WAIT_CALLBACK" });
    assert.match(summary, /PayTR|doğrulama/i);
  });
});
