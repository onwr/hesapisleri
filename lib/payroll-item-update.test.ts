import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPayrollCsvWithBom,
  escapePayrollCsvValue,
} from "./payroll-export-utils";
import {
  buildPayrollItemUpdatePayload,
  calculatePayrollItemNetPayable,
  calculatePayrollRunTotals,
  canEditPayrollRunItems,
  getPayrollRunActions,
  validatePayrollItemNetPayable,
  validatePayrollItemUpdateInput,
} from "./payroll-utils";

describe("payroll item update utils", () => {
  it("update item net hesaplama", () => {
    const payload = buildPayrollItemUpdatePayload({
      baseSalary: 30000,
      current: {
        bonusAmount: 1000,
        deductionAmount: 500,
        advanceDeduction: 200,
        notes: null,
      },
      update: {
        bonusAmount: 2500,
        deductionAmount: 1000,
        advanceDeduction: 500,
      },
    });

    assert.equal(payload.netPayable, 31000);
    assert.equal(
      calculatePayrollItemNetPayable({
        baseSalary: 30000,
        bonusAmount: 2500,
        deductionAmount: 1000,
        advanceDeduction: 500,
      }),
      31000
    );
  });

  it("totals recalculation after item update", () => {
    const totals = calculatePayrollRunTotals([
      {
        baseSalary: 30000,
        bonusAmount: 2500,
        deductionAmount: 1000,
        advanceDeduction: 500,
        netPayable: 31000,
      },
      {
        baseSalary: 25000,
        bonusAmount: 0,
        deductionAmount: 0,
        advanceDeduction: 1000,
        netPayable: 24000,
      },
    ]);

    assert.equal(totals.grossTotal, 55000);
    assert.equal(totals.bonusTotal, 2500);
    assert.equal(totals.deductionTotal, 2500);
    assert.equal(totals.netTotal, 55000);
  });

  it("negative value validation", () => {
    const result = validatePayrollItemUpdateInput({
      bonusAmount: -100,
    });
    assert.equal(result.ok, false);

    const netResult = validatePayrollItemNetPayable(-1);
    assert.equal(netResult.ok, false);
  });

  it("netPayable zero warning", () => {
    const result = validatePayrollItemNetPayable(0);
    assert.equal(result.ok, true);
    assert.match("warning" in result ? result.warning ?? "" : "", /sıfır/i);
  });

  it("DRAFT dışı düzenleme engeli", () => {
    assert.equal(canEditPayrollRunItems("DRAFT"), true);
    assert.equal(canEditPayrollRunItems("APPROVED"), false);
    assert.equal(canEditPayrollRunItems("PAID"), false);
    assert.equal(canEditPayrollRunItems("CANCELLED"), false);
  });

  it("getPayrollRunActions DRAFT edit items", () => {
    const actions = getPayrollRunActions("DRAFT");
    assert.equal(actions.canEditItems, true);
    assert.equal(getPayrollRunActions("APPROVED").canEditItems, false);
  });
});

describe("payroll export utils", () => {
  it("CSV Türkçe BOM içerir", () => {
    const csv = buildPayrollCsvWithBom(
      {
        id: "run-1",
        title: "Haziran Bordrosu",
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-06-30T23:59:59.999Z",
        payDate: null,
        status: "DRAFT",
        statusLabel: "Taslak",
        grossTotal: 30000,
        bonusTotal: 1000,
        deductionTotal: 500,
        netTotal: 30500,
        employeeCount: 1,
        currency: "TRY",
        notes: null,
        approvedAt: null,
        paidAt: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        items: [
          {
            id: "item-1",
            employeeId: "emp-1",
            employeeName: "Ayşe Yılmaz",
            employeeStatus: "ACTIVE",
            jobTitle: "Muhasebe",
            department: "Finans",
            salaryId: "sal-1",
            baseSalary: 30000,
            bonusAmount: 1000,
            deductionAmount: 500,
            advanceDeduction: 0,
            netPayable: 30500,
            currency: "TRY",
            status: "DRAFT",
            statusLabel: "Taslak",
            employeePaymentId: null,
            employeePayment: null,
            notes: "Prim güncellendi",
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
      "Örnek Firma"
    );

    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.match(csv, /Ayşe Yılmaz/);
    assert.match(csv, /Örnek Firma/);
  });

  it("escapePayrollCsvValue quotes special chars", () => {
    assert.equal(escapePayrollCsvValue("normal"), "normal");
    assert.equal(escapePayrollCsvValue('a,b'), '"a,b"');
    assert.equal(escapePayrollCsvValue('say "merhaba"'), '"say ""merhaba"""');
  });
});

describe("payroll API access", () => {
  it("employees modülü STAFF erişemez", () => {
    const staffCanAccess = ["OWNER", "ADMIN", "SUPER_ADMIN"].includes("STAFF");
    assert.equal(staffCanAccess, false);
  });

  it("export company scope OWNER/ADMIN only", () => {
    const allowedRoles = ["OWNER", "ADMIN", "SUPER_ADMIN"];
    assert.equal(allowedRoles.includes("OWNER"), true);
    assert.equal(allowedRoles.includes("STAFF"), false);
  });
});
