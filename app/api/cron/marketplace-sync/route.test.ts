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
});
