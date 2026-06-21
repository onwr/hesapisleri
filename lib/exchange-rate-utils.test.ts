import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getExchangeWindowKey,
  isSnapshotStale,
  normalizeExchangeRates,
} from "./exchange-rate-utils";

describe("exchange rate utils", () => {
  it("windowKey uses 6-hour buckets in Europe/Istanbul", () => {
    const morning = new Date("2026-06-19T08:30:00+03:00");
    const afternoon = new Date("2026-06-19T14:30:00+03:00");

    assert.equal(getExchangeWindowKey(morning), "2026-06-19-06");
    assert.equal(getExchangeWindowKey(afternoon), "2026-06-19-12");
  });

  it("normalizes valid rates", () => {
    const rates = normalizeExchangeRates({
      USD: 38.521,
      EUR: 44.119,
      GBP: 51.301,
    });

    assert.equal(rates.USD, 38.52);
    assert.equal(rates.EUR, 44.12);
    assert.equal(rates.GBP, 51.3);
  });

  it("rejects invalid rates", () => {
    assert.throws(() =>
      normalizeExchangeRates({
        USD: 0,
        EUR: 44,
        GBP: 51,
      })
    );
  });

  it("detects stale snapshots", () => {
    const expiresAt = new Date("2026-06-19T12:00:00Z");
    assert.equal(
      isSnapshotStale(expiresAt, new Date("2026-06-19T12:00:01Z")),
      true
    );
    assert.equal(
      isSnapshotStale(expiresAt, new Date("2026-06-19T11:59:59Z")),
      false
    );
  });
});
