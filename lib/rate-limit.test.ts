import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkRateLimit, buildCouponValidateRateLimitKey } from "@/lib/rate-limit";

describe("rate limit", () => {
  it("blocks after limit exceeded", () => {
    const key = buildCouponValidateRateLimitKey({
      userId: "u1",
      companyId: "c1",
      ip: "1.2.3.4",
    });

    for (let i = 0; i < 5; i += 1) {
      const result = checkRateLimit({ key, limit: 5, windowMs: 60_000 });
      assert.equal(result.allowed, true);
    }

    const blocked = checkRateLimit({ key, limit: 5, windowMs: 60_000 });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.ok(blocked.retryAfterSec >= 1);
    }
  });
});
