import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateLeaveDays,
  getEmployeeStatusLabel,
  getEmploymentTypeLabel,
  normalizeEmployeeInput,
  validateEmployeeInput,
  calculateEmployeeBalance,
  getPaymentTypeLabel,
  getPaymentStatusBadgeClass,
  isEmployeeLeaveVisibleOnCalendar,
} from "./employee-utils";
import {
  applyEmployeeFilters,
  EMPLOYEE_TABS,
  getEmployeeInitials,
} from "./employee-page-utils";

describe("employee utils", () => {
  it("status label döner", () => {
    assert.equal(getEmployeeStatusLabel("ACTIVE"), "Aktif");
    assert.equal(getEmployeeStatusLabel("ON_LEAVE"), "İzinli");
  });

  it("employment type label döner", () => {
    assert.equal(getEmploymentTypeLabel("FULL_TIME"), "Tam zamanlı");
    assert.equal(getEmploymentTypeLabel("INTERN"), "Stajyer");
  });

  it("leave days hesaplar", () => {
    const start = new Date("2026-06-01T00:00:00");
    const end = new Date("2026-06-03T00:00:00");
    assert.equal(calculateLeaveDays(start, end), 3);
  });

  it("employee balance hesaplar", () => {
    const balance = calculateEmployeeBalance([
      {
        amount: 1000,
        status: "PENDING",
        direction: "PAYABLE",
        type: "SALARY",
      },
      {
        amount: 500,
        status: "PAID",
        direction: "PAID",
        type: "SALARY",
      },
      {
        amount: 200,
        status: "PENDING",
        direction: "DEDUCTED",
        type: "DEDUCTION",
      },
    ] as never);

    assert.equal(balance.totalPending, 1000);
    assert.equal(balance.totalPaid, 500);
    assert.equal(balance.totalDeductions, 200);
    assert.equal(balance.netPayable, 800);
  });

  it("fullName ile normalize eder", () => {
    const normalized = normalizeEmployeeInput({ fullName: "Ayşe Yılmaz" });
    assert.equal(normalized.firstName, "Ayşe");
    assert.equal(normalized.lastName, "Yılmaz");
  });

  it("ad/soyad zorunluluğunu doğrular", () => {
    const normalized = normalizeEmployeeInput({});
    const result = validateEmployeeInput(normalized);
    assert.equal(result.ok, false);
  });

  it("geçerli input kabul eder", () => {
    const normalized = normalizeEmployeeInput({
      firstName: "Mehmet",
      lastName: "Demir",
      email: "mehmet@example.com",
    });
    const result = validateEmployeeInput(normalized);
    assert.equal(result.ok, true);
  });

  it("tab filtreleri uygular", () => {
    const employees = [
      {
        status: "ACTIVE",
        fullName: "A",
        email: null,
        phone: null,
        jobTitle: null,
        department: null,
        employmentType: "FULL_TIME",
        hasUserAccount: false,
        hasPosAccess: false,
        activeSalary: null,
        createdAt: "",
        startDate: null,
        balance: { netPayable: 0 },
        paymentSummary: { netPayable: 0, pendingCount: 0, pendingTotal: 0 },
        performanceSummary: { thisMonthSales: 0, thisMonthSaleCount: 0 },
      },
      {
        status: "PASSIVE",
        fullName: "B",
        email: null,
        phone: null,
        jobTitle: null,
        department: null,
        employmentType: "FULL_TIME",
        hasUserAccount: false,
        hasPosAccess: false,
        activeSalary: null,
        createdAt: "",
        startDate: null,
        balance: { netPayable: 0 },
        paymentSummary: { netPayable: 0, pendingCount: 0, pendingTotal: 0 },
        performanceSummary: { thisMonthSales: 0, thisMonthSaleCount: 0 },
      },
    ] as never;

    const filtered = applyEmployeeFilters({
      employees,
      tab: "active",
      search: "",
      department: "",
      jobTitle: "",
      status: "",
      employmentType: "",
      sort: "name",
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].fullName, "A");
  });

  it("employee tabs davetler içermez", () => {
    assert.equal(
      EMPLOYEE_TABS.some((tab) => tab.label === "Davetler"),
      false
    );
  });

  it("avatar initials fallback üretir", () => {
    assert.equal(getEmployeeInitials("Ayşe Yılmaz"), "AY");
    assert.equal(getEmployeeInitials("Ali"), "AL");
  });

  it("isEmployeeLeaveVisibleOnCalendar approved için true döner", () => {
    assert.equal(isEmployeeLeaveVisibleOnCalendar("APPROVED"), true);
    assert.equal(isEmployeeLeaveVisibleOnCalendar("PENDING"), false);
  });

  it("getPaymentTypeLabel Türkçe etiket döner", () => {
    assert.equal(getPaymentTypeLabel("SALARY"), "Maaş");
    assert.equal(getPaymentTypeLabel("ADVANCE"), "Avans");
  });

  it("getPaymentStatusBadgeClass durum sınıfı döner", () => {
    assert.match(getPaymentStatusBadgeClass("PAID"), /emerald/);
    assert.match(getPaymentStatusBadgeClass("OVERDUE"), /red/);
  });
});
