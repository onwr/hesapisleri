import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateMembershipAmount,
  calculateMembershipEndDate,
  getMembershipPeriodMonths,
  getMembershipStatus,
  resolveMembershipPeriodStart,
} from "./membership-utils";

describe("membership utils", () => {
  it("MONTHLY +1 ay ekler", () => {
    const start = new Date("2026-06-10T10:00:00.000Z");
    const end = calculateMembershipEndDate(start, "MONTHLY");
    assert.equal(end.getMonth(), 6);
    assert.equal(end.getDate(), 10);
  });

  it("QUARTERLY +3 ay ekler", () => {
    assert.equal(getMembershipPeriodMonths("QUARTERLY"), 3);
    const start = new Date("2026-01-15T00:00:00.000Z");
    const end = calculateMembershipEndDate(start, "QUARTERLY");
    assert.equal(end.getMonth(), 3);
  });

  it("SEMI_ANNUAL +6 ay ekler", () => {
    assert.equal(getMembershipPeriodMonths("SEMI_ANNUAL"), 6);
  });

  it("YEARLY +12 ay ekler", () => {
    assert.equal(getMembershipPeriodMonths("YEARLY"), 12);
    const start = new Date("2026-06-10T00:00:00.000Z");
    const end = calculateMembershipEndDate(start, "YEARLY");
    assert.equal(end.getFullYear(), 2027);
  });

  it("mevcut bitiş tarihi gelecekteyse yeni süre onun üstüne eklenir", () => {
    const currentEnd = new Date("2026-06-25T00:00:00.000Z");
    const reference = new Date("2026-06-10T00:00:00.000Z");
    const start = resolveMembershipPeriodStart(currentEnd, reference);
    const end = calculateMembershipEndDate(start, "MONTHLY");

    assert.equal(start.toISOString(), currentEnd.toISOString());
    assert.equal(end.getMonth(), 6);
    assert.equal(end.getDate(), 25);
  });

  it("üyelik bitmişse bugünden başlar", () => {
    const currentEnd = new Date("2026-05-01T00:00:00.000Z");
    const reference = new Date("2026-06-10T00:00:00.000Z");
    const start = resolveMembershipPeriodStart(currentEnd, reference);

    assert.equal(start.toISOString(), reference.toISOString());
  });

  it("fiyat döneme göre hesaplanır", () => {
    const plan = {
      monthlyPrice: 1000,
      quarterlyPrice: 2700,
      semiAnnualPrice: 5000,
      yearlyPrice: 9000,
    };

    assert.equal(calculateMembershipAmount(plan, "MONTHLY"), 1000);
    assert.equal(calculateMembershipAmount(plan, "QUARTERLY"), 2700);
    assert.equal(calculateMembershipAmount(plan, "SEMI_ANNUAL"), 5000);
    assert.equal(calculateMembershipAmount(plan, "YEARLY"), 9000);
  });

  it("aktif üyelik durumunu döner", () => {
    const status = getMembershipStatus({
      status: "ACTIVE",
      currentPeriodEnd: new Date("2026-12-31T00:00:00.000Z"),
    });

    assert.equal(status, "ACTIVE");
  });

  it("süresi dolmuş üyelik durumunu döner", () => {
    const status = getMembershipStatus(
      {
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-01-01T00:00:00.000Z"),
      },
      new Date("2026-06-10T00:00:00.000Z")
    );

    assert.equal(status, "EXPIRED");
  });
});
