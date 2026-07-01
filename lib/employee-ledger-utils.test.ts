import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildEmployeeLedgerRows,
  calculateEmployeeCurrentBalance,
  resolveLedgerDebitCredit,
} from "./employee-ledger-utils";
import { employeeSalaryFormSchema } from "./employee-salary-utils";
import { canProcessEmployeePayments } from "./permission-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("employee ledger utils", () => {
  it("maaş tahakkuku bakiye artırır", () => {
    const balance = calculateEmployeeCurrentBalance([
      {
        amount: 10000,
        status: "PENDING",
        direction: "PAYABLE",
        type: "SALARY",
      },
    ]);
    assert.equal(balance, 10000);
  });

  it("ödeme bakiye azaltır", () => {
    const balance = calculateEmployeeCurrentBalance([
      {
        amount: 10000,
        status: "PENDING",
        direction: "PAYABLE",
        type: "SALARY",
      },
      {
        amount: 6000,
        status: "PAID",
        direction: "PAID",
        type: "SALARY",
      },
    ]);
    assert.equal(balance, 4000);
  });

  it("ödenen avans maaş borcundan mahsup edilir", () => {
    const balance = calculateEmployeeCurrentBalance([
      {
        amount: 5000,
        status: "PENDING",
        direction: "PAYABLE",
        type: "SALARY",
      },
      {
        amount: 2000,
        status: "PAID",
        direction: "PAID",
        type: "ADVANCE",
      },
    ]);
    assert.equal(balance, 3000);
  });

  it("yalnız avans çalışanın şirkete borcunu gösterir", () => {
    const balance = calculateEmployeeCurrentBalance([
      {
        amount: 2000,
        status: "PAID",
        direction: "PAID",
        type: "ADVANCE",
      },
    ]);
    assert.equal(balance, -2000);
  });

  it("kesinti bakiye azaltır", () => {
    const balance = calculateEmployeeCurrentBalance([
      {
        amount: 5000,
        status: "PAID",
        direction: "DEDUCTED",
        type: "DEDUCTION",
      },
    ]);
    assert.equal(balance, -5000);
  });

  it("cari hareket listesi tarihe göre sıralanır", () => {
    const rows = buildEmployeeLedgerRows([
      {
        id: "p1",
        type: "SALARY",
        direction: "PAYABLE",
        amount: 1000,
        status: "PENDING",
        description: "Ocak",
        dueDate: "2026-01-15T00:00:00.000Z",
        paidAt: null,
        createdAt: "2026-01-15T00:00:00.000Z",
      },
      {
        id: "p2",
        type: "SALARY",
        direction: "PAID",
        amount: 500,
        status: "PAID",
        description: "Ödeme",
        dueDate: null,
        paidAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ]);

    assert.equal(rows.length, 2);
    assert.ok(rows[0]!.date >= rows[1]!.date);
    assert.equal(rows[0]!.balance, 500);
  });

  it("düzeltme direction borç tarafında çalışır", () => {
    const debit = resolveLedgerDebitCredit({
      type: "OTHER",
      status: "PENDING",
      direction: "PAYABLE",
      amount: 250,
    });
    assert.equal(debit.debit, 250);
    assert.equal(debit.credit, 0);
  });
});

describe("employee salary utils", () => {
  it("netSalary negatif olamaz", () => {
    const parsed = employeeSalaryFormSchema.safeParse({ amount: -1 });
    assert.equal(parsed.success, false);
  });

  it("paymentDay 1-31 arası olmalı", () => {
    const invalid = employeeSalaryFormSchema.safeParse({
      amount: 1000,
      paymentDay: 32,
    });
    assert.equal(invalid.success, false);

    const valid = employeeSalaryFormSchema.safeParse({
      amount: 1000,
      paymentDay: 15,
    });
    assert.equal(valid.success, true);
  });
});

describe("employee salary UI integration", () => {
  it("detay sayfasında maaş ve cari sekmeleri vardır", () => {
    const detail = read("components/employees/employee-detail-client.tsx");
    assert.match(detail, /Maaş Bilgisi/);
    assert.match(detail, /Cari Hareketler/);
    assert.match(detail, /EmployeeSalaryTab/);
    assert.match(detail, /EmployeeLedgerTab/);
  });

  it("çalışan formunda maaş alanları vardır", () => {
    const createModal = read("components/employees/employee-create-modal.tsx");
    assert.match(createModal, /Net maaş/);
    assert.match(createModal, /Maaş ödeme günü/);
    assert.match(createModal, /IBAN/);
  });

  it("liste satırında net maaş ve cari bakiye görünür", () => {
    const row = read("components/employees/employee-list-row.tsx");
    assert.match(row, /formatEmployeeSalarySummary/);
    assert.match(row, /formatEmployeeLedgerSummary/);
  });
});

describe("employee payment permissions", () => {
  it("STAFF ödeme yapamaz", () => {
    assert.equal(canProcessEmployeePayments("STAFF"), false);
  });

  it("OWNER ödeme yapabilir", () => {
    assert.equal(canProcessEmployeePayments("OWNER"), true);
  });
});

describe("employee ledger API integration", () => {
  it("ledger route company scope ve validasyon içerir", () => {
    const route = read("app/api/employees/[id]/ledger/route.ts");
    assert.match(route, /requireApiEmployeesPermission\("processPayments"\)/);
    assert.match(route, /ledgerBodySchema/);
    assert.match(route, /createEmployeeLedgerMovement/);
  });

  it("salary route GET ve PATCH içerir", () => {
    const route = read("app/api/employees/[id]/salary/route.ts");
    assert.match(route, /export async function GET/);
    assert.match(route, /export async function PATCH/);
    assert.match(route, /manageSalary/);
  });
});
