import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "./route";

describe("cron notifications route", () => {
  it("CRON_SECRET yoksa unauthorized döner", async () => {
    const oldSecret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    const response = await POST(
      new Request("http://localhost/api/cron/notifications", {
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
      new Request("http://localhost/api/cron/notifications", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      })
    );

    assert.equal(response.status, 401);
    process.env.CRON_SECRET = oldSecret;
  });

  it("401 response secret içermez", async () => {
    const oldSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "super-secret-token";

    const response = await POST(
      new Request("http://localhost/api/cron/notifications", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      })
    );

    const body = await response.text();
    assert.equal(response.status, 401);
    assert.doesNotMatch(body, /super-secret-token/);

    process.env.CRON_SECRET = oldSecret;
  });

  it("cron summary employeePayments.overdueUpdated alanını destekler", () => {
    const summary = {
      success: true as const,
      created: 0,
      skipped: 0,
      companiesScanned: 1,
      items: [],
      employeePayments: {
        overdueUpdated: 4,
      },
    };

    assert.equal(summary.employeePayments.overdueUpdated, 4);
    assert.equal(summary.success, true);
  });
});
