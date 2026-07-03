import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildCustomerFinanceNote,
  parseCustomerFinanceAmount,
  parseCustomerFinanceNote,
  validateCustomerFinanceAccount,
} from "@/lib/customer-finance-utils";

describe("customer finance utils", () => {
  it("parseCustomerFinanceAmount rejects non-positive values", () => {
    const result = parseCustomerFinanceAmount(0);
    assert.equal(result.ok, false);
  });

  it("buildCustomerFinanceNote round-trips", () => {
    const note = buildCustomerFinanceNote({
      customerId: "cust-1",
      kind: "collection",
      idempotencyKey: "key-1",
    });
    const parsed = parseCustomerFinanceNote(note);
    assert.deepEqual(parsed, {
      customerId: "cust-1",
      kind: "collection",
      idempotencyKey: "key-1",
    });
  });

  it("validateCustomerFinanceAccount rejects foreign tenant account", () => {
    const result = validateCustomerFinanceAccount(
      {
        id: "acc-1",
        companyId: "company-b",
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        name: "Kasa",
        balance: 100,
      },
      "company-a",
      { purpose: "payment", amount: 10, checkBalance: true }
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /şirkete ait değil/);
    }
  });

  it("validateCustomerFinanceAccount rejects insufficient balance for payment", () => {
    const result = validateCustomerFinanceAccount(
      {
        id: "acc-1",
        companyId: "company-a",
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        name: "Kasa",
        balance: 5,
      },
      "company-a",
      { purpose: "payment", amount: 10, checkBalance: true, allowNegativeCashBalance: false }
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /yetersiz/);
    }
  });
});

describe("customer finance hotfix wiring", () => {
  it("finance account read includes employees/customers/suppliers modules", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/module-access.ts"),
      "utf8"
    );
    assert.match(source, /requireApiFinanceAccountRead/);
    assert.match(source, /"employees"/);
    assert.match(source, /"customers"/);
    assert.match(source, /"suppliers"/);
  });

  it("supplier finance routes do not require cash-bank manage", () => {
    const paymentRoute = fs.readFileSync(
      path.join(process.cwd(), "app/api/suppliers/[id]/payments/route.ts"),
      "utf8"
    );
    const collectionRoute = fs.readFileSync(
      path.join(process.cwd(), "app/api/suppliers/[id]/collections/route.ts"),
      "utf8"
    );
    assert.match(paymentRoute, /requireApiSupplierFinance/);
    assert.match(collectionRoute, /requireApiSupplierFinance/);
    assert.doesNotMatch(paymentRoute, /requireApiCashBankManage/);
    assert.doesNotMatch(collectionRoute, /requireApiCashBankManage/);
  });

  it("employee payment UI does not mention addon entitlement", () => {
    const financeUtils = fs.readFileSync(
      path.join(process.cwd(), "lib/finance-account-utils.ts"),
      "utf8"
    );
    assert.doesNotMatch(financeUtils, /eklentisi/i);
    assert.match(
      financeUtils,
      /Ödeme yapabilmek için aktif bir kasa veya banka hesabı oluşturun/
    );
  });

  it("customer finance routes exist", () => {
    assert.ok(
      fs.existsSync(
        path.join(process.cwd(), "app/api/customers/[id]/collections/route.ts")
      )
    );
    assert.ok(
      fs.existsSync(
        path.join(process.cwd(), "app/api/customers/[id]/payments/route.ts")
      )
    );
  });

  it("customer-payment invalidates cache domains", () => {
    const matrix = fs.readFileSync(
      path.join(process.cwd(), "lib/tenant-cache/tenant-mutation-matrix.ts"),
      "utf8"
    );
    assert.match(matrix, /"customer-payment":/);
    assert.match(matrix, /customer-ledger/);
  });

  it("finance account options does not require status field in select", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "lib/account-read-service.ts"),
      "utf8"
    );
    assert.match(source, /isFinanceOutflowAccountType\(account\.type\)/);
    assert.doesNotMatch(source, /isFinanceOutflowEligibleAccount\(account\)/);
  });

  it("customer finance actions refresh tenant cache on mutation", () => {
    const actions = fs.readFileSync(
      path.join(process.cwd(), "components/customers/customer-finance-actions.tsx"),
      "utf8"
    );
    assert.match(actions, /useTenantCacheSync/);
    assert.match(actions, /refresh:\s*true/);
    assert.match(actions, /onSuccess/);
  });
});
