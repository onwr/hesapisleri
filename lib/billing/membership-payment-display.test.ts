import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickLatestPaidMembershipPayment,
  resolveMembershipPaymentAmount,
} from "./membership-payment-display";

describe("membership-payment-display", () => {
  it("prefers amountMinor over legacy decimal amount", () => {
    assert.equal(
      resolveMembershipPaymentAmount({ amount: 1799.8, amountMinor: 179880 }),
      1798.8
    );
  });

  it("1499 + %20 KDV = 1798,80 minor-unit", () => {
    assert.equal(
      resolveMembershipPaymentAmount({ amount: 1799.8, amountMinor: 179880 }),
      1798.8
    );
  });

  it("pickLatestPaidMembershipPayment uses paidAt desc", () => {
    type Row = {
      id: string;
      status: "PAID" | "PENDING";
      paidAt: Date | null;
      createdAt: Date;
    };
    const picked = pickLatestPaidMembershipPayment<Row>([
      {
        id: "older",
        status: "PAID",
        paidAt: new Date("2026-01-01"),
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "latest",
        status: "PAID",
        paidAt: new Date("2026-06-01"),
        createdAt: new Date("2026-05-01"),
      },
      {
        id: "pending",
        status: "PENDING",
        paidAt: null,
        createdAt: new Date("2026-07-01"),
      },
    ] as Row[]);

    assert.equal(picked?.id, "latest");
  });
});
