import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessFinance,
  canAccessModule,
  canAccessPOS,
  canManageInvoices,
  canManageProducts,
  canManageSettings,
  canManageUsers,
} from "./permission-utils";
import { getSidebarMenuItems } from "./sidebar-menu";

describe("permission utils", () => {
  it("OWNER kullanıcı yönetebilir", () => {
    assert.equal(canManageUsers("OWNER"), true);
    assert.equal(canManageUsers("ADMIN", true), true);
  });

  it("ADMIN kullanıcı davet edebilir", () => {
    assert.equal(canManageUsers("ADMIN"), true);
  });

  it("STAFF kullanıcı yönetemez", () => {
    assert.equal(canManageUsers("STAFF"), false);
    assert.equal(canManageUsers("ACCOUNTANT"), false);
  });

  it("ADMIN ayarları yönetebilir", () => {
    assert.equal(canManageSettings("ADMIN"), true);
  });

  it("STAFF ayarları sınırlı yönetir", () => {
    assert.equal(canManageSettings("STAFF"), false);
    assert.equal(canManageSettings("ACCOUNTANT"), false);
  });

  it("ACCOUNTANT finansa erişebilir", () => {
    assert.equal(canAccessFinance("ACCOUNTANT"), true);
    assert.equal(canAccessFinance("STAFF"), false);
  });

  it("STAFF kasa/banka modülüne erişemez", () => {
    assert.equal(canAccessModule("STAFF", "cash-bank"), false);
    assert.equal(canAccessModule("STAFF", "expenses"), false);
    assert.equal(canAccessModule("STAFF", "reports"), false);
  });

  it("STAFF POS erişebilir, ACCOUNTANT erişemez", () => {
    assert.equal(canAccessPOS("STAFF"), true);
    assert.equal(canAccessPOS("ACCOUNTANT"), false);
    assert.equal(canAccessPOS("ADMIN"), true);
  });

  it("ACCOUNTANT fatura yönetebilir, STAFF yönetemez", () => {
    assert.equal(canManageInvoices("ACCOUNTANT"), true);
    assert.equal(canManageInvoices("STAFF"), false);
  });

  it("STAFF ürün yönetebilir, ACCOUNTANT yönetemez", () => {
    assert.equal(canManageProducts("STAFF"), true);
    assert.equal(canManageProducts("ACCOUNTANT"), false);
  });
});

describe("sidebar menu filtering", () => {
  it("ACCOUNTANT finans menülerini görür, POS görmez", () => {
    const titles = getSidebarMenuItems("ACCOUNTANT").map((item) => item.title);
    assert.ok(titles.includes("Kasa & Banka"));
    assert.ok(titles.includes("Giderler"));
    assert.ok(titles.includes("Raporlar"));
    assert.ok(!titles.includes("POS / Hızlı Satış"));
    assert.ok(!titles.includes("Ürünler"));
  });

  it("STAFF operasyon menülerini görür, finans menülerini görmez", () => {
    const titles = getSidebarMenuItems("STAFF").map((item) => item.title);
    assert.ok(titles.includes("POS / Hızlı Satış"));
    assert.ok(titles.includes("Ürünler"));
    assert.ok(titles.includes("Stoklar"));
    assert.ok(!titles.includes("Kasa & Banka"));
    assert.ok(!titles.includes("Giderler"));
    assert.ok(!titles.includes("Raporlar"));
  });

  it("OWNER tüm menüleri görür", () => {
    const titles = getSidebarMenuItems("OWNER").map((item) => item.title);
    assert.ok(titles.includes("POS / Hızlı Satış"));
    assert.ok(titles.includes("Kasa & Banka"));
    assert.ok(titles.includes("Raporlar"));
    assert.ok(titles.includes("Ürünler"));
  });
});
