import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createUserFromEmployeeSchema,
  getRoleModulePreview,
  updateCompanyUserPasswordSchema,
  validateAssignableRole,
} from "./company-user-from-employee-utils";

describe("company user from employee utils", () => {
  it("employeeId zorunludur", () => {
    const parsed = createUserFromEmployeeSchema.safeParse({
      employeeId: "",
      email: "personel@firma.com",
      password: "12345678",
      passwordConfirm: "12345678",
      role: "STAFF",
    });

    assert.equal(parsed.success, false);
  });

  it("şifre minimum 8 karakter olmalıdır", () => {
    const parsed = createUserFromEmployeeSchema.safeParse({
      employeeId: "emp-1",
      email: "personel@firma.com",
      password: "1234567",
      passwordConfirm: "1234567",
      role: "STAFF",
    });

    assert.equal(parsed.success, false);
  });

  it("şifreler eşleşmelidir", () => {
    const parsed = createUserFromEmployeeSchema.safeParse({
      employeeId: "emp-1",
      email: "personel@firma.com",
      password: "12345678",
      passwordConfirm: "87654321",
      role: "STAFF",
    });

    assert.equal(parsed.success, false);
  });

  it("OWNER atanamaz", () => {
    const result = validateAssignableRole("OWNER");
    assert.equal(result.ok, false);
  });

  it("SUPER_ADMIN atanamaz", () => {
    const result = validateAssignableRole("SUPER_ADMIN");
    assert.equal(result.ok, false);
  });

  it("POS_STAFF sadece POS modülünü açar", () => {
    const preview = getRoleModulePreview("POS_STAFF");
    const allowed = preview.filter((entry) => entry.allowed).map((entry) => entry.module);

    assert.deepEqual(allowed, ["pos"]);
  });

  it("ACCOUNTANT finans modüllerine erişir", () => {
    const preview = getRoleModulePreview("ACCOUNTANT");
    const allowed = new Set(
      preview.filter((entry) => entry.allowed).map((entry) => entry.module)
    );

    assert.equal(allowed.has("invoices"), true);
    assert.equal(allowed.has("cash-bank"), true);
    assert.equal(allowed.has("reports"), true);
    assert.equal(allowed.has("pos"), false);
  });

  it("şifre güncelleme şeması eşleşmeyi doğrular", () => {
    const parsed = updateCompanyUserPasswordSchema.safeParse({
      password: "yeniSifre123",
      passwordConfirm: "yeniSifre123",
    });

    assert.equal(parsed.success, true);
  });
});
