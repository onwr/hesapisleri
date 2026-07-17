import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  resolvePosCheckoutSettlement,
  validatePosPaymentLines,
} from "../components/pos/pos-payment-modal";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/pos/page.tsx"),
  "utf8"
);
const modalSource = fs.readFileSync(
  path.join(process.cwd(), "components/pos/pos-payment-modal.tsx"),
  "utf8"
);

describe("pos veresiye ui", () => {
  it("müşteri seçilmeden cari satış hatası verir", () => {
    const error = validatePosPaymentLines({
      lines: [],
      total: 100,
      accounts: [],
      settlementMode: "ON_ACCOUNT",
      customerId: "",
    });
    assert.equal(error, "Veresiye satış için müşteri seçmelisiniz.");
  });

  it("müşteri seçilince cari satış geçerli", () => {
    const error = validatePosPaymentLines({
      lines: [],
      total: 100,
      accounts: [],
      settlementMode: "ON_ACCOUNT",
      customerId: "c1",
    });
    assert.equal(error, null);
  });

  it("parçalı nakit + cari kalan destekler", () => {
    const accounts = [
      {
        id: "cash-1",
        name: "Kasa",
        type: "CASH" as const,
        status: "ACTIVE" as const,
        balance: 0,
        currency: "TRY",
        isDefault: true,
      },
    ];
    const error = validatePosPaymentLines({
      lines: [
        {
          id: "1",
          paymentMethod: "CASH",
          amount: "400",
          accountId: "cash-1",
        },
      ],
      total: 1000,
      accounts,
      settlementMode: "COLLECT",
      customerId: "c1",
      allowOnAccountRemainder: true,
    });
    assert.equal(error, null);

    const settlement = resolvePosCheckoutSettlement({
      settlementMode: "COLLECT",
      lines: [
        {
          id: "1",
          paymentMethod: "CASH",
          amount: "400",
          accountId: "cash-1",
        },
      ],
      total: 1000,
    });
    assert.equal(settlement.paymentStatus, "PARTIAL");
    assert.equal(settlement.collectedAmount, 400);
    assert.equal(settlement.remainingOnAccount, 600);
  });

  it("tam cari settlement UNPAID üretir", () => {
    const settlement = resolvePosCheckoutSettlement({
      settlementMode: "ON_ACCOUNT",
      lines: [],
      total: 250.5,
    });
    assert.equal(settlement.paymentStatus, "UNPAID");
    assert.equal(settlement.collectedAmount, 0);
    assert.equal(settlement.remainingOnAccount, 250.5);
    assert.equal(settlement.payments.length, 0);
  });

  it("POS UI cari başarı ve müşteri linklerini içerir", () => {
    assert.match(modalSource, /Cari.?ye Yaz/);
    assert.match(modalSource, /cari hesabına borç/);
    assert.match(pageSource, /Müşteri Cari Hesabını Aç/);
    assert.match(pageSource, /Tahsilat Al/);
    assert.match(pageSource, /settlementMode/);
    assert.match(pageSource, /paymentStatus: settlement\.paymentStatus/);
  });
});
