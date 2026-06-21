import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildPosAccountEmail,
  parsePosUsernameFromEmail,
  sanitizePosUsername,
} from "./employee-pos-utils";
import {
  canAccessModule,
  getAccessibleModules,
  getPostAuthRedirectPath,
} from "./permission-utils";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("employee team simplify", () => {
  it("EMPLOYEE_TABS davet sekmesi içermez", async () => {
    const { EMPLOYEE_TABS } = await import("./employee-page-utils");
    assert.equal(
      EMPLOYEE_TABS.some((tab) => tab.label === "Davetler"),
      false
    );
    assert.deepEqual(
      EMPLOYEE_TABS.map((tab) => tab.key),
      ["active", "on_leave", "passive", "all"]
    );
  });

  it("POS hesabı e-posta ve kullanıcı adı dönüşümü", () => {
    const companyId = "cmp_123";
    const username = sanitizePosUsername("Ayşe.POS");
    assert.equal(username, "aye.pos");
    const email = buildPosAccountEmail("ayse.pos", companyId);
    assert.equal(email, `ayse.pos@${companyId}.pos.hesapisleri.local`);
    assert.equal(parsePosUsernameFromEmail(email, companyId), "ayse.pos");
  });

  it("POS_STAFF yalnızca pos modülüne erişir", () => {
    assert.equal(canAccessModule("POS_STAFF", "pos"), true);
    assert.equal(canAccessModule("POS_STAFF", "dashboard"), false);
    assert.equal(canAccessModule("POS_STAFF", "employees"), false);
    assert.equal(canAccessModule("POS_STAFF", "settings"), false);
    assert.equal(canAccessModule("POS_STAFF", "sales"), false);

    const modules = getAccessibleModules("POS_STAFF");
    assert.deepEqual(modules, ["pos"]);
  });

  it("POS_STAFF giriş sonrası /pos yönlendirmesi", () => {
    assert.equal(getPostAuthRedirectPath("POS_STAFF"), "/pos");
    assert.equal(getPostAuthRedirectPath("ADMIN"), "/dashboard");
  });
});

describe("employee team dashboard UI", () => {
  it("/team ekranında Davetler tabı yok", () => {
    const filters = read("components/employees/employee-filters.tsx");
    assert.doesNotMatch(filters, /Davetler/);
  });

  it("/team ekranında sistem/davet metinleri yok", () => {
    const teamPage = read("components/team/team-page-client.tsx");
    const shell = read("components/team/team-shell.tsx");
    assert.doesNotMatch(teamPage, /Sisteme kullanıcı davet et/i);
    assert.doesNotMatch(teamPage, /Sistem hesabı/i);
    assert.doesNotMatch(shell, /Davetler/i);
    assert.doesNotMatch(shell, /CompanyUser/i);
  });

  it("/team dashboard stili StatCard ve ActionCard kullanır", () => {
    const shell = read("components/team/team-shell.tsx");
    assert.match(shell, /StatCard/);
    assert.match(shell, /ActionCard/);
    assert.match(shell, /rounded-\[24px\]|TEAM_HERO_CLASS/);
  });

  it("Departmanları Yönet linki yöneticide görünür", () => {
    const shell = read("components/team/team-shell.tsx");
    assert.match(shell, /Departmanları Yönet/);
    assert.match(shell, /\/team\/departments/);
  });

  it("çalışan listesi kart satırı ve avatar kullanır", () => {
    const listRow = read("components/employees/employee-list-row.tsx");
    const actionsModal = read("components/employees/employee-actions-modal.tsx");
    const avatar = read("components/employees/employee-avatar.tsx");
    assert.match(listRow, /EmployeeListRow/);
    assert.match(listRow, /EmployeeAvatar/);
    assert.match(listRow, /EmployeeActionsModal/);
    assert.match(listRow, /POS erişimi var/);
    assert.match(actionsModal, /createPortal/);
    assert.match(avatar, /getEmployeeInitials/);
    assert.match(avatar, /rounded-full/);
  });
});

describe("employee detail dashboard UI", () => {
  it("/team/[id] Sistem Hesabı sekmesi yok", () => {
    const detail = read("components/employees/employee-detail-client.tsx");
    assert.doesNotMatch(detail, /Sistem Hesabı/);
    assert.doesNotMatch(detail, /link-user|unlink-user|Sistem hesabı/i);
  });

  it("/team/[id] POS Erişimi sekmesi var", () => {
    const detail = read("components/employees/employee-detail-client.tsx");
    assert.match(detail, /POS Erişimi/);
    assert.match(detail, /key: "pos"/);
  });

  it("detay sayfası profil header ve StatCard kullanır", () => {
    const detail = read("components/employees/employee-detail-client.tsx");
    assert.match(detail, /EmployeeProfileHeader/);
    assert.match(detail, /StatCard/);
  });

  it("POS sekmesi kullanıcı dostu metinler içerir", () => {
    const posTab = read("components/employees/employee-pos-tab.tsx");
    assert.match(posTab, /POS erişimi yok/);
    assert.match(posTab, /POS Hesabı Oluştur/);
    assert.doesNotMatch(posTab, /POS_STAFF/);
  });

  it("Bordro Özeti sekmesi payroll linki içerir", () => {
    const payrollTab = read("components/employees/employee-payroll-summary-tab.tsx");
    assert.match(payrollTab, /\/team\/payroll/);
  });
});

describe("settings users separation copy", () => {
  it("Ayarlar kullanıcı paneli personelden kullanıcı oluşturmayı vurgular", () => {
    const settings = read("components/settings/settings-users-panel.tsx");
    assert.match(settings, /personel kayıtlarından oluşturulur/i);
    assert.match(settings, /Personelden Kullanıcı Oluştur/i);
  });
});
