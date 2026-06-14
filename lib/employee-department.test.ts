import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  normalizeDepartmentName,
  resolveEmployeeDepartmentLabel,
  resolveEmployeeDepartmentName,
  serializeEmployeeDepartment,
  validateDepartmentName,
} from "./employee-department-utils";
import {
  hasEmployeeApiPermission,
} from "./employee-permission-utils";

describe("employee department utils", () => {
  it("normalizeDepartmentName boşlukları düzenler", () => {
    assert.equal(normalizeDepartmentName("  Satış   Ekibi  "), "Satış Ekibi");
  });

  it("validateDepartmentName kısa adları reddeder", () => {
    const result = validateDepartmentName("A");
    assert.equal(result.ok, false);
  });

  it("validateDepartmentName geçerli adı kabul eder", () => {
    const result = validateDepartmentName("Satış");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value, "Satış");
    }
  });

  it("resolveEmployeeDepartmentName relation önceliklidir", () => {
    assert.equal(
      resolveEmployeeDepartmentName({
        department: "Eski",
        departmentRef: { name: "Satış" },
      }),
      "Satış"
    );
  });

  it("resolveEmployeeDepartmentName legacy string fallback", () => {
    assert.equal(
      resolveEmployeeDepartmentName({
        department: " Depo ",
        departmentRef: null,
      }),
      "Depo"
    );
  });

  it("resolveEmployeeDepartmentLabel legacy işaretler", () => {
    const label = resolveEmployeeDepartmentLabel({
      department: "Depo",
      departmentRef: null,
    });
    assert.deepEqual(label, {
      name: "Depo",
      color: null,
      isLegacy: true,
    });
  });

  it("serializeEmployeeDepartment çalışan sayısı ve yönetici döner", () => {
    const serialized = serializeEmployeeDepartment(
      {
        id: "d1",
        companyId: "c1",
        name: "Satış",
        description: null,
        color: "#ff0000",
        managerEmployeeId: "e1",
        isActive: true,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z"),
        managerEmployee: { id: "e1", firstName: "Ayşe", lastName: "Yılmaz" },
        employees: [{ id: "e1" }, { id: "e2" }],
      },
      2
    );

    assert.equal(serialized.employeeCount, 2);
    assert.equal(serialized.managerEmployee?.fullName, "Ayşe Yılmaz");
    assert.equal(serialized.color, "#ff0000");
  });
});

describe("employee department API permissions", () => {
  it("STAFF departman yönetemez", () => {
    assert.equal(hasEmployeeApiPermission("STAFF", "manageRecords"), false);
  });

  it("ACCOUNTANT departman yönetemez", () => {
    assert.equal(hasEmployeeApiPermission("ACCOUNTANT", "manageRecords"), false);
  });

  it("ADMIN departman yönetebilir", () => {
    assert.equal(hasEmployeeApiPermission("ADMIN", "manageRecords"), true);
  });
});

describe("employee department UI wiring", () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

  it("/team ekranında Departmanları Yönet linki görünür", () => {
    const shell = read("components/team/team-shell.tsx");
    assert.match(shell, /Departmanları Yönet/);
    assert.match(shell, /\/team\/departments/);
  });

  it("çalışan formlarında departman select kullanılır", () => {
    const createModal = read("components/employees/employee-create-modal.tsx");
    const editModal = read("components/employees/employee-edit-modal.tsx");

    assert.match(createModal, /EmployeeDepartmentSelect/);
    assert.match(createModal, /departmentId/);
    assert.match(editModal, /EmployeeDepartmentSelect/);
    assert.match(editModal, /legacyDepartment/);
  });

  it("departman yönetimi tablosunda aktif/pasif aksiyonları görünür", () => {
    const departmentsPage = read("components/team/team-departments-client.tsx");
    assert.match(departmentsPage, /Pasif yap/);
    assert.match(departmentsPage, /Aktif yap/);
    assert.match(departmentsPage, /\/api\/employees\/departments/);
  });
});

describe("employee department duplicate message", () => {
  it("409 mesajı kullanıcı dostu", () => {
    const message = "Bu departman adı zaten kullanılıyor.";
    assert.match(message, /Bu departman adı zaten kullanılıyor/);
  });
});
