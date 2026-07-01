import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PaymentAttemptStatus } from "@prisma/client";
import {
  assertValidTransition,
  canCancel,
  canFinalize,
  isTerminalStatus,
} from "./sipay-state-machine";
import { SipayError } from "./sipay-errors";

function allows(from: PaymentAttemptStatus, to: PaymentAttemptStatus): void {
  assert.doesNotThrow(() => assertValidTransition(from, to));
}

function rejects(from: PaymentAttemptStatus, to: PaymentAttemptStatus): void {
  assert.throws(
    () => assertValidTransition(from, to),
    (err: unknown) => err instanceof SipayError,
  );
}

describe("sipay-state-machine — izin verilen geçişler", () => {
  it("CREATED → CHECKOUT_LINK_READY | FAILED | CANCELLED", () => {
    allows("CREATED", "CHECKOUT_LINK_READY");
    allows("CREATED", "FAILED");
    allows("CREATED", "CANCELLED");
  });

  it("CHECKOUT_LINK_READY → PENDING | COMPLETED | FAILED | CANCELLED", () => {
    allows("CHECKOUT_LINK_READY", "PENDING");
    allows("CHECKOUT_LINK_READY", "COMPLETED");
    allows("CHECKOUT_LINK_READY", "FAILED");
    allows("CHECKOUT_LINK_READY", "CANCELLED");
  });

  it("PENDING → COMPLETED | FAILED | CANCELLED", () => {
    allows("PENDING", "COMPLETED");
    allows("PENDING", "FAILED");
    allows("PENDING", "CANCELLED");
  });
});

describe("sipay-state-machine — reddedilen geçişler", () => {
  it("COMPLETED terminal — FAILED/CANCELLED reddedilir", () => {
    rejects("COMPLETED", "FAILED");
    rejects("COMPLETED", "CANCELLED");
    rejects("COMPLETED", "PENDING");
  });

  it("FAILED/CANCELLED → COMPLETED doğrudan reddedilir", () => {
    rejects("FAILED", "COMPLETED");
    rejects("CANCELLED", "COMPLETED");
  });

  it("CREATED → COMPLETED doğrudan reddedilir", () => {
    rejects("CREATED", "COMPLETED");
  });
});

describe("sipay-state-machine — yardımcılar", () => {
  it("canFinalize yalnız CHECKOUT_LINK_READY ve PENDING", () => {
    assert.equal(canFinalize("CHECKOUT_LINK_READY"), true);
    assert.equal(canFinalize("PENDING"), true);
    assert.equal(canFinalize("COMPLETED"), false);
  });

  it("canCancel COMPLETED dahil terminal durumları reddeder", () => {
    assert.equal(canCancel("COMPLETED"), false);
    assert.equal(canCancel("FAILED"), false);
    assert.equal(canCancel("PENDING"), true);
  });

  it("isTerminalStatus", () => {
    assert.equal(isTerminalStatus("COMPLETED"), true);
    assert.equal(isTerminalStatus("PENDING"), false);
  });
});
