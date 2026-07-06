import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

describe("membership-plan-resolution", () => {
  it("resolveActiveMembershipPlanForCheckout canonical koddan sonra ACTIVE fallback içerir", async () => {
    const content = await fs.readFile("lib/billing/membership-plan-resolution.ts", "utf8");
    assert.match(content, /DEFAULT_MEMBERSHIP_PLAN_CODE/);
    assert.match(content, /planStatus: "ACTIVE"/);
    assert.match(content, /orderBy: \[\{ sortOrder: "asc" \}/);
  });

  it("resolveBillingPlanForCompany bekleyen Sipay PaymentAttempt planId kullanır", async () => {
    const content = await fs.readFile("lib/billing/membership-plan-resolution.ts", "utf8");
    assert.match(content, /paymentAttempt\.findFirst/);
    assert.match(content, /provider: "SIPAY"/);
    assert.match(content, /pendingAttempt\?\.planId/);
  });

  it("getMembershipBillingData artık subscription.plan null iken throw etmez — resolver kullanır", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    const fnStart = content.indexOf("export async function getMembershipBillingData");
    const fnEnd = content.indexOf("export async function createMembershipPayment");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.match(fnBody, /resolveBillingPlanForCompany/);
    assert.ok(!fnBody.includes("if (!subscriptionPlan)"));
  });
});
