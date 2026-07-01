import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ACCOUNT_TYPE_LABELS,
  accountShowsBankFields,
  createAccountSchema,
} from "./account-utils";
import { canManageAccounts } from "./permission-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("account utils", () => {
  it("createAccountSchema name zorunlu", () => {
    const parsed = createAccountSchema.safeParse({
      name: "   ",
      type: "CASH",
    });
    assert.equal(parsed.success, false);
  });

  it("createAccountSchema type zorunlu", () => {
    const parsed = createAccountSchema.safeParse({
      name: "Kasa",
      type: "INVALID",
    });
    assert.equal(parsed.success, false);
  });

  it("createAccountSchema geçerli veriyi kabul eder", () => {
    const parsed = createAccountSchema.safeParse({
      name: "Merkez Kasa",
      type: "BANK",
      bankName: "Garanti BBVA",
      openingBalance: 1000,
      currency: "TRY",
    });
    assert.equal(parsed.success, true);
  });

  it("BANK tipinde banka alanları gösterilir", () => {
    assert.equal(accountShowsBankFields("BANK"), true);
    assert.equal(accountShowsBankFields("CASH"), false);
  });

  it("hesap tipi etiketleri Türkçe", () => {
    assert.equal(ACCOUNT_TYPE_LABELS.CASH, "Kasa");
    assert.equal(ACCOUNT_TYPE_LABELS.CREDIT_CARD, "Kredi Kartı");
    assert.equal(ACCOUNT_TYPE_LABELS.POS, "POS Hesabı");
  });
});

describe("account permissions", () => {
  it("OWNER/ADMIN hesap oluşturabilir", () => {
    assert.equal(canManageAccounts("OWNER"), true);
    assert.equal(canManageAccounts("ADMIN"), true);
  });

  it("STAFF ve ACCOUNTANT hesap oluşturamaz", () => {
    assert.equal(canManageAccounts("STAFF"), false);
    assert.equal(canManageAccounts("ACCOUNTANT"), false);
  });
});

describe("account UI integration", () => {
  it("cash-bank sayfasında Yeni Hesap kartı ve modal vardır", () => {
    const actions = read("components/cash-bank/cash-bank-list-actions.tsx");
    assert.match(actions, /Yeni Hesap/);
    assert.match(actions, /AccountFormDialog/);
  });

  it("account form dialog noValidate ve Türkçe validasyon kullanır", () => {
    const dialog = read("components/cash-bank/account-form-dialog.tsx");
    assert.match(dialog, /noValidate/);
    assert.match(dialog, /validateAccountCreateForm/);
  });

  it("account API handlers yetki kontrolü içerir", () => {
    const handlers = read("lib/account-api-handlers.ts");
    assert.match(handlers, /requireApiCashBankManage/);
    assert.match(handlers, /requireApiCashBankRead/);
  });

  it("activity log mesajları güvenli helper kullanır", () => {
    const service = read("lib/account-admin-service.ts");
    assert.match(service, /buildSafeActivityMessage/);
    assert.match(service, /createActivityLog/);
    assert.doesNotMatch(service, /Hesap oluşturuldu: \$\{account\.name\}/);
  });

  it("options endpoint sadece aktif hesapları döndürür", () => {
    const service = read("lib/account-admin-service.ts");
    assert.match(service, /status: "ACTIVE"/);
  });

  it("açılış bakiyesi transaction olarak kaydedilir", () => {
    const service = read("lib/account-admin-service.ts");
    assert.match(service, /Açılış bakiyesi/);
  });

  it("duplicate name 409 döner", () => {
    const service = read("lib/account-admin-service.ts");
    assert.match(service, /status: 409/);
    assert.match(service, /Bu isimde bir hesap zaten var/);
  });

  it("varsayılan hesap arşivlenemez", () => {
    const service = read("lib/account-admin-service.ts");
    assert.match(service, /Varsayılan hesap arşivlenemez/);
  });
});
