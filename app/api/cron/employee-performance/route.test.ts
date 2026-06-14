import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "./route";

describe("cron employee performance route", () => {
  it("CRON_SECRET yoksa unauthorized döner", async () => {
    const oldSecret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    const response = await POST(
      new Request("http://localhost/api/cron/employee-performance", {
        method: "POST",
        headers: { authorization: "Bearer abc" },
      })
    );

    assert.equal(response.status, 401);
    process.env.CRON_SECRET = oldSecret;
  });

  it("CRON_SECRET yanlışsa unauthorized döner", async () => {
    const oldSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "abc";

    const response = await POST(
      new Request("http://localhost/api/cron/employee-performance", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      })
    );

    assert.equal(response.status, 401);
    process.env.CRON_SECRET = oldSecret;
  });
});
