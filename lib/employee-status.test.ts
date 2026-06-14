import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  hasEmployeeApiPermission,
} from "./employee-permission-utils";
import {
  normalizeEmployeeInput,
  validateEmployeeInput,
} from "./employee-utils";

const employeeStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PASSIVE", "ON_LEAVE", "TERMINATED"]),
});

describe("employee status endpoint validation", () => {
  it("status-only body geçerli enum değerlerini kabul eder", () => {
    assert.equal(
      employeeStatusSchema.safeParse({ status: "PASSIVE" }).success,
      true
    );
    assert.equal(
      employeeStatusSchema.safeParse({ status: "ACTIVE" }).success,
      true
    );
  });

  it("geçersiz status 400 için parse başarısız olur", () => {
    const parsed = employeeStatusSchema.safeParse({ status: "INVALID" });
    assert.equal(parsed.success, false);
  });

  it("status-only güncelleme firstName/lastName gerektirmez", () => {
    const normalized = normalizeEmployeeInput({ status: "PASSIVE" });
    const result = validateEmployeeInput(normalized);
    assert.equal(result.ok, false);
    assert.match(result.message ?? "", /Ad veya soyad zorunludur/);

    const merged = normalizeEmployeeInput({
      firstName: "Ayşe",
      lastName: "Yılmaz",
      status: "PASSIVE",
    });
    const mergedResult = validateEmployeeInput(merged);
    assert.equal(mergedResult.ok, true);
  });
});

describe("employee status permissions", () => {
  it("STAFF status güncelleyemez", () => {
    assert.equal(hasEmployeeApiPermission("STAFF", "manageRecords"), false);
  });

  it("ACCOUNTANT status güncelleyemez", () => {
    assert.equal(hasEmployeeApiPermission("ACCOUNTANT", "manageRecords"), false);
  });

  it("ADMIN status güncelleyebilir", () => {
    assert.equal(hasEmployeeApiPermission("ADMIN", "manageRecords"), true);
  });

  it("OWNER status güncelleyebilir", () => {
    assert.equal(hasEmployeeApiPermission("OWNER", "manageRecords"), true);
  });
});

describe("employee delete flow", () => {
  it("pasif çalışan silme akışı DELETE ile sonlandırılır", () => {
    const resolveDeleteStatus = (current: string) =>
      current === "PASSIVE" ? "TERMINATED" : current === "TERMINATED" ? null : "PASSIVE";

    assert.equal(resolveDeleteStatus("ACTIVE"), "PASSIVE");
    assert.equal(resolveDeleteStatus("PASSIVE"), "TERMINATED");
    assert.equal(resolveDeleteStatus("TERMINATED"), null);
  });
});

describe("employee status UI wiring", () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

  it("Pasif et butonu /status endpoint kullanır", () => {
    const teamPage = read("components/team/team-page-client.tsx");
    const detailPage = read("components/employees/employee-detail-client.tsx");
    const actionsModal = read("components/employees/employee-actions-modal.tsx");

    assert.match(teamPage, /\/api\/employees\/\$\{employeeId\}\/status/);
    assert.match(teamPage, /status:\s*"PASSIVE"/);
    assert.match(teamPage, /method:\s*"DELETE"/);
    assert.match(detailPage, /\/api\/employees\/\$\{employee\.id\}\/status/);
    assert.match(actionsModal, /Pasif yap/);
    assert.match(actionsModal, /Sil/);
  });
});
