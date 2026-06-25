import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COLLECTION_ACCOUNT_EMPTY_MESSAGE,
  groupCollectionAccounts,
  isCollectionEligibleAccount,
  isCollectionEligibleAccountType,
  resolveDefaultCollectionAccountId,
  validateCollectionAccount,
} from "@/lib/collection-account-utils";
import { recordSaleCollection, roundMoney } from "@/lib/sale-payment-utils";

const activeCash = {
  id: "cash-1",
  name: "Merkez Kasa",
  type: "CASH",
  balance: 100,
  currency: "TRY",
  isDefault: true,
};

const activeBank = {
  id: "bank-1",
  name: "Ziraat Bankası",
  type: "BANK",
  balance: 500,
  currency: "TRY",
  isDefault: false,
  bankName: "Ziraat",
};

const legacyStaticCash = {
  id: "static-cash",
  name: "Eski Kasa",
  type: "STATIC",
  balance: 50,
  currency: "TRY",
  isDefault: false,
};

const legacyStaticBank = {
  id: "static-bank",
  name: "Eski Banka",
  type: "STATIC",
  balance: 200,
  currency: "TRY",
  isDefault: false,
  bankName: "İş Bankası",
  iban: "TR000000000000000000000000",
};

const posAccount = {
  id: "pos-1",
  name: "POS Terminal",
  type: "POS",
  balance: 0,
  currency: "TRY",
  isDefault: false,
};

describe("sales collection account options", () => {
  it("lists active cash and bank accounts for selection", () => {
    const grouped = groupCollectionAccounts([activeCash, activeBank]);
    assert.equal(grouped.cashAccounts.length, 1);
    assert.equal(grouped.bankAccounts.length, 1);
    assert.equal(grouped.cashAccounts[0]?.id, "cash-1");
    assert.equal(grouped.bankAccounts[0]?.id, "bank-1");
  });

  it("includes legacy STATIC accounts without excluding CASH", () => {
    assert.equal(isCollectionEligibleAccountType("STATIC"), true);
    assert.equal(isCollectionEligibleAccountType("CASH"), true);
    assert.equal(isCollectionEligibleAccountType("POS"), false);

    const grouped = groupCollectionAccounts([
      activeCash,
      legacyStaticCash,
      legacyStaticBank,
    ]);

    assert.equal(grouped.cashAccounts.length, 2);
    assert.equal(grouped.bankAccounts.length, 1);
    assert.ok(grouped.cashAccounts.some((account) => account.id === "cash-1"));
    assert.ok(
      grouped.cashAccounts.some((account) => account.id === "static-cash")
    );
    assert.ok(
      grouped.bankAccounts.some((account) => account.id === "static-bank")
    );
  });

  it("rejects passive, foreign tenant and POS accounts", () => {
    assert.equal(
      isCollectionEligibleAccount({ type: "CASH", status: "PASSIVE" }),
      false
    );
    assert.equal(
      validateCollectionAccount(
        {
          id: "cash-1",
          companyId: "company-2",
          type: "CASH",
          status: "ACTIVE",
          name: "Kasa",
        },
        "company-1"
      ).ok,
      false
    );
    assert.equal(
      validateCollectionAccount(
        {
          id: "pos-1",
          companyId: "company-1",
          type: "POS",
          status: "ACTIVE",
          name: "POS",
        },
        "company-1"
      ).ok,
      false
    );
  });

  it("resolves default account and preserves valid selection", () => {
    assert.equal(
      resolveDefaultCollectionAccountId([activeCash, activeBank]),
      "cash-1"
    );
    assert.equal(
      resolveDefaultCollectionAccountId([activeCash, activeBank], "bank-1"),
      "bank-1"
    );
  });

  it("shows the required empty-state message", () => {
    assert.match(
      COLLECTION_ACCOUNT_EMPTY_MESSAGE,
      /Aktif kasa veya banka hesabı bulunamadı/
    );
  });
});

describe("sales collection payload wiring", () => {
  it("new sale create schema expects accountId when payment is collected", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const createRoute = fs.readFileSync(
      path.join(__dirname, "..", "app/api/sales/create/route.ts"),
      "utf8"
    );
    const newSalePage = fs.readFileSync(
      path.join(__dirname, "..", "app/sales/new/page.tsx"),
      "utf8"
    );

    assert.match(createRoute, /accountId/);
    assert.match(createRoute, /Tahsilat hesabı seçilmelidir/);
    assert.match(newSalePage, /accountId: paymentStatus === "UNPAID" \? undefined : accountId/);
    assert.match(newSalePage, /useCollectionAccounts/);
  });

  it("sale collect modal and inline payment send accountId to API", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const modal = fs.readFileSync(
      path.join(__dirname, "..", "components/sales/sale-collect-modal.tsx"),
      "utf8"
    );
    const inline = fs.readFileSync(
      path.join(__dirname, "..", "components/sales/sale-collect-payment.tsx"),
      "utf8"
    );
    const collectApi = fs.readFileSync(
      path.join(__dirname, "..", "app/api/sales/[id]/collect/route.ts"),
      "utf8"
    );

    assert.match(modal, /accountId/);
    assert.match(modal, /useCollectionAccounts/);
    assert.match(inline, /accountId/);
    assert.match(inline, /useCollectionAccounts/);
    assert.match(collectApi, /requireAnyApiModuleAccess/);
    assert.match(collectApi, /"sales"/);
    assert.match(collectApi, /accountId/);
  });

  it("blocks submit without account selection in UI", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const modal = fs.readFileSync(
      path.join(__dirname, "..", "components/sales/sale-collect-modal.tsx"),
      "utf8"
    );
    const inline = fs.readFileSync(
      path.join(__dirname, "..", "components/sales/sale-collect-payment.tsx"),
      "utf8"
    );

    assert.match(modal, /Tahsilat hesabı seçin/);
    assert.match(modal, /Boolean\(accountId\)/);
    assert.match(inline, /Tahsilat hesabı seçin/);
    assert.match(inline, /Boolean\(accountId\)/);
  });
});

describe("recordSaleCollection", () => {
  it("requires accountId and writes income transaction to selected account", async () => {
    const updates: Array<{ id: string; balance: number }> = [];
    const transactions: Array<{
      accountId: string;
      type: string;
      title: string;
      amount: number;
    }> = [];

    const tx = {
      account: {
        findFirst: async () => ({
          id: "cash-1",
          companyId: "company-1",
          type: "CASH",
          status: "ACTIVE",
          name: "Merkez Kasa",
          currency: "TRY",
        }),
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { balance: { increment: number } };
        }) => {
          updates.push({
            id: where.id,
            balance: data.balance.increment,
          });
        },
      },
      accountTransaction: {
        create: async ({
          data,
        }: {
          data: {
            accountId: string;
            type: string;
            title: string;
            amount: number;
          };
        }) => {
          transactions.push(data);
        },
      },
    };

    await assert.rejects(
      () =>
        recordSaleCollection(tx as never, {
          companyId: "company-1",
          saleNo: "S-100",
          amount: 100,
          accountId: "",
        }),
      /Tahsilat hesabı seçilmelidir/
    );

    const account = await recordSaleCollection(tx as never, {
      companyId: "company-1",
      saleNo: "S-100",
      amount: 125.5,
      accountId: "cash-1",
    });

    assert.equal(account?.id, "cash-1");
    assert.equal(updates[0]?.id, "cash-1");
    assert.equal(updates[0]?.balance, 125.5);
    assert.equal(transactions[0]?.accountId, "cash-1");
    assert.equal(transactions[0]?.type, "INCOME");
    assert.equal(transactions[0]?.amount, 125.5);
    assert.equal(roundMoney(125.5), 125.5);
  });
});
