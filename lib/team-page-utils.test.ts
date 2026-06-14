import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getActivityTag } from "./dashboard-metrics";
import { canAccessModule } from "./permission-utils";
import {
  applyTeamMemberFilters,
  computeTeamStats,
  filterTeamMembersByTab,
  getCompanyUserStatusLabel,
  getTeamDisplayRoleLabel,
  getTeamMemberInitials,
  parseTeamTab,
} from "./team-page-utils";

const sampleUsers = [
  {
    id: "1",
    userId: "u1",
    name: "Ali Veli",
    email: "ali@firma.com",
    role: "ADMIN",
    roleLabel: "Yönetici",
    status: "ACTIVE",
    statusLabel: "Aktif",
    isOwner: false,
    joinedAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-02T10:00:00.000Z",
  },
  {
    id: "2",
    userId: "u2",
    name: "Zeynep Kaya",
    email: "zeynep@firma.com",
    role: "STAFF",
    roleLabel: "Personel",
    status: "PASSIVE",
    statusLabel: "Pasif",
    isOwner: false,
    joinedAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-10T10:00:00.000Z",
  },
  {
    id: "3",
    userId: "u3",
    name: "Sahip User",
    email: "owner@firma.com",
    role: "OWNER",
    roleLabel: "Sahip",
    status: "ACTIVE",
    statusLabel: "Aktif",
    isOwner: true,
    joinedAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
  },
];

describe("team page utils", () => {
  it("parseTeamTab varsayılan active döner", () => {
    assert.equal(parseTeamTab(undefined), "active");
    assert.equal(parseTeamTab("foo"), "active");
    assert.equal(parseTeamTab("invites"), "invites");
  });

  it("filterTeamMembersByTab aktif/pasif ayırır", () => {
    assert.equal(filterTeamMembersByTab(sampleUsers, "active").length, 2);
    assert.equal(filterTeamMembersByTab(sampleUsers, "passive").length, 1);
    assert.equal(filterTeamMembersByTab(sampleUsers, "invites").length, 0);
  });

  it("applyTeamMemberFilters arama ve rol filtresi uygular", () => {
    const rows = applyTeamMemberFilters({
      users: sampleUsers,
      tab: "all",
      search: "zeynep",
      roleFilter: "",
      sort: "name",
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.email, "zeynep@firma.com");
  });

  it("computeTeamStats metrikleri hesaplar", () => {
    const now = new Date();
    const recentJoin = new Date(now);
    recentJoin.setDate(recentJoin.getDate() - 5);
    const oldJoin = new Date(now);
    oldJoin.setDate(oldJoin.getDate() - 40);

    const users = [
      {
        ...sampleUsers[0]!,
        joinedAt: recentJoin.toISOString(),
      },
      sampleUsers[1]!,
      {
        ...sampleUsers[2]!,
        joinedAt: oldJoin.toISOString(),
      },
    ];

    const stats = computeTeamStats(users, [
      {
        id: "i1",
        email: "new@firma.com",
        role: "STAFF",
        roleLabel: "Personel",
        status: "PENDING",
        expiresAt: "2026-06-20T10:00:00.000Z",
        inviteLink: "http://localhost/invite?token=abc",
      },
    ]);

    assert.equal(stats.activeCount, 2);
    assert.equal(stats.pendingInvites, 1);
    assert.equal(stats.adminCount, 2);
    assert.equal(stats.joinedLast30Days, 1);
  });

  it("status label mapping doğru çalışır", () => {
    assert.equal(getCompanyUserStatusLabel("ACTIVE"), "Aktif");
    assert.equal(getCompanyUserStatusLabel("PASSIVE"), "Pasif");
    assert.equal(getCompanyUserStatusLabel("INVITED"), "Davetli");
  });

  it("getTeamDisplayRoleLabel owner için Sahip döner", () => {
    assert.equal(getTeamDisplayRoleLabel("ADMIN", true), "Sahip");
  });

  it("getTeamMemberInitials baş harfleri üretir", () => {
    assert.equal(getTeamMemberInitials("Ali Veli", "ali@firma.com"), "AV");
  });
});

describe("team module access", () => {
  it("settings-users modülüne STAFF erişemez", () => {
    assert.equal(canAccessModule("STAFF", "settings-users"), false);
    assert.equal(canAccessModule("ACCOUNTANT", "settings-users"), false);
  });

  it("settings-users modülüne OWNER ve ADMIN erişir", () => {
    assert.equal(canAccessModule("OWNER", "settings-users"), true);
    assert.equal(canAccessModule("ADMIN", "settings-users"), true);
  });
});

describe("dashboard activity tag team sync", () => {
  it("settings modülü Ekip etiketi döner", () => {
    assert.deepEqual(getActivityTag("settings"), {
      label: "Ekip",
      color: "purple",
    });
  });

  it("team modülü Ekip etiketi döner", () => {
    assert.deepEqual(getActivityTag("team"), {
      label: "Ekip",
      color: "purple",
    });
  });
});
