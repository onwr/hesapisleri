import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachEmployeePaymentsOverdueSummary,
  shouldMarkEmployeePaymentOverdue,
  startOfCalendarDay,
} from "./employee-payment-overdue-service";

describe("employee payment overdue service", () => {
  const referenceDate = new Date(2026, 5, 8, 15, 30, 0);

  it("dueDate geçmiş PENDING → OVERDUE adayı", () => {
    assert.equal(
      shouldMarkEmployeePaymentOverdue({
        status: "PENDING",
        dueDate: new Date(2026, 5, 7, 12, 0, 0),
        referenceDate,
      }),
      true
    );
  });

  it("dueDate bugün → değişmez", () => {
    assert.equal(
      shouldMarkEmployeePaymentOverdue({
        status: "PENDING",
        dueDate: startOfCalendarDay(referenceDate),
        referenceDate,
      }),
      false
    );
  });

  it("dueDate gelecek → değişmez", () => {
    assert.equal(
      shouldMarkEmployeePaymentOverdue({
        status: "PENDING",
        dueDate: new Date(2026, 5, 10, 0, 0, 0),
        referenceDate,
      }),
      false
    );
  });

  it("PAID değişmez", () => {
    assert.equal(
      shouldMarkEmployeePaymentOverdue({
        status: "PAID",
        dueDate: new Date(2026, 5, 1, 0, 0, 0),
        referenceDate,
      }),
      false
    );
  });

  it("CANCELLED değişmez", () => {
    assert.equal(
      shouldMarkEmployeePaymentOverdue({
        status: "CANCELLED",
        dueDate: new Date(2026, 5, 1, 0, 0, 0),
        referenceDate,
      }),
      false
    );
  });

  it("dueDate null değişmez", () => {
    assert.equal(
      shouldMarkEmployeePaymentOverdue({
        status: "PENDING",
        dueDate: null,
        referenceDate,
      }),
      false
    );
  });

  it("OVERDUE zaten işaretli kayıt tekrar aday olmaz", () => {
    assert.equal(
      shouldMarkEmployeePaymentOverdue({
        status: "OVERDUE",
        dueDate: new Date(2026, 5, 1, 0, 0, 0),
        referenceDate,
      }),
      false
    );
  });

  it("attachEmployeePaymentsOverdueSummary cron response alanı ekler", () => {
    const summary = attachEmployeePaymentsOverdueSummary(
      {
        success: true,
        created: 2,
        skipped: 1,
        companiesScanned: 3,
        items: [],
      },
      { scanned: 5, updated: 5, skipped: 0 }
    );

    assert.equal(summary.employeePayments?.overdueUpdated, 5);
    assert.equal(summary.success, true);
    assert.equal(summary.created, 2);
  });

  it("idempotent ikinci çalıştırmada updated=0 olabilir", () => {
    const summary = attachEmployeePaymentsOverdueSummary(
      {
        success: true,
        created: 0,
        skipped: 0,
        companiesScanned: 1,
        items: [],
      },
      { scanned: 0, updated: 0, skipped: 0 }
    );

    assert.equal(summary.employeePayments?.overdueUpdated, 0);
  });
});
