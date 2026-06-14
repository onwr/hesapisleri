import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getEmployeeModulePermissions,
  hasEmployeeApiPermission,
} from "./employee-permission-utils";
import {
  canAccessEmployees,
  canManageEmployees,
  canProcessEmployeePayments,
} from "./permission-utils";
import { getSidebarMenuItems } from "./sidebar-menu";

describe("employee module permissions", () => {
  it("ACCOUNTANT çalışan modülünü görüntüleyebilir", () => {
    assert.equal(canAccessEmployees("ACCOUNTANT"), true);
    assert.equal(canManageEmployees("ACCOUNTANT"), false);
    assert.equal(canProcessEmployeePayments("ACCOUNTANT"), true);
  });

  it("ACCOUNTANT yönetici işlemlerini yapamaz", () => {
    assert.equal(hasEmployeeApiPermission("ACCOUNTANT", "manageRecords"), false);
    assert.equal(hasEmployeeApiPermission("ACCOUNTANT", "manageSalary"), false);
    assert.equal(hasEmployeeApiPermission("ACCOUNTANT", "managePayroll"), false);
    assert.equal(hasEmployeeApiPermission("ACCOUNTANT", "manageTargets"), false);
  });

  it("ACCOUNTANT ödeme işaretleyebilir", () => {
    assert.equal(hasEmployeeApiPermission("ACCOUNTANT", "processPayments"), true);
  });

  it("ADMIN tüm çalışan yetkilerine sahiptir", () => {
    const perms = getEmployeeModulePermissions("ADMIN");
    assert.equal(perms.canView, true);
    assert.equal(perms.canManageRecords, true);
    assert.equal(perms.canManagePayroll, true);
    assert.equal(perms.canProcessPayments, true);
    assert.equal(perms.canManageTargets, true);
    assert.equal(perms.isReadOnlyViewer, false);
  });

  it("ACCOUNTANT salt okunur görüntüleyicidir", () => {
    const perms = getEmployeeModulePermissions("ACCOUNTANT");
    assert.equal(perms.canView, true);
    assert.equal(perms.canManageRecords, false);
    assert.equal(perms.canManagePayroll, false);
    assert.equal(perms.canProcessPayments, true);
    assert.equal(perms.isReadOnlyViewer, true);
  });

  it("STAFF çalışan modülüne erişemez", () => {
    assert.equal(canAccessEmployees("STAFF"), false);
  });
});

describe("sidebar employees menu for accountant", () => {
  it("ACCOUNTANT sidebar'da Çalışanlar menüsünü görür", () => {
    const titles = getSidebarMenuItems("ACCOUNTANT").map((item) => item.title);
    assert.ok(titles.includes("Çalışanlar"));
  });
});
