import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "./route";

describe("cron marketplace sync route", () => {
  it("secret yanlışsa unauthorized döner", async () => {
    const oldSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "abc";

    const response = await POST(
      new Request("http://localhost/api/cron/marketplace-sync", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      })
    );

    assert.equal(response.status, 401);
    process.env.CRON_SECRET = oldSecret;
  });

  it("feature flag kapalıyken sync atlar, hata vermez", async () => {
    const oldSecret = process.env.CRON_SECRET;
    const oldFlag = process.env.MARKETPLACE_FEATURE_ENABLED;
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.MARKETPLACE_FEATURE_ENABLED = "false";

    const response = await POST(
      new Request("http://localhost/api/cron/marketplace-sync", {
        method: "POST",
        headers: { authorization: "Bearer cron-test-secret" },
      })
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.skipped, true);

    process.env.CRON_SECRET = oldSecret;
    if (oldFlag === undefined) delete process.env.MARKETPLACE_FEATURE_ENABLED;
    else process.env.MARKETPLACE_FEATURE_ENABLED = oldFlag;
  });
});
