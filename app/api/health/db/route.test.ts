import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GET } from "./route";

describe("GET /api/health/db", () => {
  it("CRON_SECRET yoksa unauthorized döner", async () => {
    const oldHealth = process.env.DB_HEALTH_SECRET;
    const oldCron = process.env.CRON_SECRET;
    delete process.env.DB_HEALTH_SECRET;
    delete process.env.CRON_SECRET;

    const response = await GET(new Request("http://localhost/api/health/db"));
    assert.equal(response.status, 401);

    process.env.DB_HEALTH_SECRET = oldHealth;
    process.env.CRON_SECRET = oldCron;
  });

  it("yanlış secret unauthorized döner", async () => {
    const oldCron = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "expected-secret";
    delete process.env.DB_HEALTH_SECRET;

    const response = await GET(
      new Request("http://localhost/api/health/db", {
        headers: { authorization: "Bearer wrong-secret" },
      })
    );
    assert.equal(response.status, 401);

    process.env.CRON_SECRET = oldCron;
  });

  it("doğru secret ile SELECT 1 sonucu döner", async () => {
    const oldCron = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "health-test-secret";
    delete process.env.DB_HEALTH_SECRET;

    const response = await GET(
      new Request("http://localhost/api/health/db", {
        headers: { authorization: "Bearer health-test-secret" },
      })
    );

    const json = (await response.json()) as {
      success: boolean;
      latencyMs?: number;
    };

    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(typeof json.latencyMs, "number");

    process.env.CRON_SECRET = oldCron;
  });

  it("response connection string içermez", async () => {
    const oldCron = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "health-test-secret";

    const response = await GET(
      new Request("http://localhost/api/health/db", {
        headers: { authorization: "Bearer health-test-secret" },
      })
    );

    const body = await response.text();
    assert.doesNotMatch(body, /postgresql:\/\//i);
    assert.doesNotMatch(body, /DATABASE_URL/i);

    process.env.CRON_SECRET = oldCron;
  });
});
