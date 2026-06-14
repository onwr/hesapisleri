import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOrdersQuery } from "./orders-page-utils";
import { parseSourceChannelFilter } from "./order-utils";

describe("orders marketplace filters", () => {
  it("channel query param ekler", () => {
    const href = buildOrdersQuery({
      tab: "all",
      channel: "TRENDYOL",
      from: "2026-01-01",
      to: "2026-01-31",
    });
    assert.ok(href.includes("channel=TRENDYOL"));
  });

  it("channel parser geçersiz değeri reddeder", () => {
    assert.equal(parseSourceChannelFilter("INVALID"), null);
    assert.equal(parseSourceChannelFilter("POS"), "POS");
    assert.equal(parseSourceChannelFilter("HEPSIBURADA"), "HEPSIBURADA");
  });

  it("HEPSIBURADA channel query param ekler", () => {
    const href = buildOrdersQuery({
      tab: "all",
      channel: "HEPSIBURADA",
    });
    assert.ok(href.includes("channel=HEPSIBURADA"));
  });
});
