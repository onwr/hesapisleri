import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectUserIssues } from "@/lib/admin/users/admin-user-issue-service";

const now = new Date();
const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

describe("LoginTrackingStatus ve issue detection", () => {
  it("UNKNOWN_LEGACY kullanıcı NEVER_LOGGED_IN issue almaz", () => {
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "UNKNOWN_LEGACY",
      lastLoginAt: null,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: false,
    });
    assert.ok(!issues.includes("NEVER_LOGGED_IN"), "legacy kullanıcı NEVER_LOGGED_IN sayılmamalı");
  });

  it("UNKNOWN_LEGACY kullanıcı INACTIVE_30D issue almaz", () => {
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "UNKNOWN_LEGACY",
      lastLoginAt: null,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: false,
    });
    assert.ok(!issues.includes("INACTIVE_30D"), "legacy kullanıcı INACTIVE_30D sayılmamalı");
  });

  it("NEVER_LOGGED_IN kullanıcı NEVER_LOGGED_IN issue alır", () => {
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "NEVER_LOGGED_IN",
      lastLoginAt: null,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: false,
    });
    assert.ok(issues.includes("NEVER_LOGGED_IN"), "yeni kullanıcı NEVER_LOGGED_IN almalı");
  });

  it("LOGGED_IN kullanıcı 30+ gün önce giriş yaptıysa INACTIVE_30D alır", () => {
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "LOGGED_IN",
      lastLoginAt: thirtyOneDaysAgo,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: false,
    });
    assert.ok(issues.includes("INACTIVE_30D"), "30+ gün geçmişse INACTIVE_30D almalı");
  });

  it("LOGGED_IN kullanıcı 15 gün önce giriş yaptıysa INACTIVE_30D almaz", () => {
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "LOGGED_IN",
      lastLoginAt: fifteenDaysAgo,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: false,
    });
    assert.ok(!issues.includes("INACTIVE_30D"), "15 gün ise INACTIVE_30D almamalı");
  });

  it("LOGGED_IN + 30+ gün + UNKNOWN_LEGACY → INACTIVE_30D olmaz", () => {
    // UNKNOWN_LEGACY kullanıcılar lastLoginAt null bile olsa INACTIVE_30D'ye girmez
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "UNKNOWN_LEGACY",
      lastLoginAt: thirtyOneDaysAgo,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: false,
    });
    assert.ok(!issues.includes("INACTIVE_30D"), "UNKNOWN_LEGACY INACTIVE_30D almamalı");
  });

  it("SUSPENDED kullanıcı SUSPENDED issue alır", () => {
    const issues = detectUserIssues({
      status: "SUSPENDED",
      loginTrackingStatus: "LOGGED_IN",
      lastLoginAt: now,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: false,
    });
    assert.ok(issues.includes("SUSPENDED"));
  });

  it("EMAIL_VERIFICATION_PENDING kullanıcı issue alır", () => {
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "LOGGED_IN",
      lastLoginAt: now,
      emailVerificationStatus: "PENDING",
      hasPendingInvite: false,
    });
    assert.ok(issues.includes("EMAIL_VERIFICATION_PENDING"));
  });

  it("hasPendingInvite=true → HAS_PENDING_INVITE issue alır", () => {
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "LOGGED_IN",
      lastLoginAt: now,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: true,
    });
    assert.ok(issues.includes("HAS_PENDING_INVITE"));
  });

  it("sorunsuz kullanıcı boş issue listesi alır", () => {
    const issues = detectUserIssues({
      status: "ACTIVE",
      loginTrackingStatus: "LOGGED_IN",
      lastLoginAt: fifteenDaysAgo,
      emailVerificationStatus: "NOT_TRACKED",
      hasPendingInvite: false,
    });
    assert.deepEqual(issues, []);
  });

  it("login route loginTrackingStatus'ü LOGGED_IN yapar", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "app", "api", "auth", "login", "route.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("loginTrackingStatus") && source.includes("LOGGED_IN"),
      "login LOGGED_IN set etmeli"
    );
    assert.ok(source.includes("lastLoginAt"), "login lastLoginAt güncellenmeli");
  });

  it("register route yeni kullanıcıya NEVER_LOGGED_IN atar", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "app", "api", "auth", "register", "route.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("NEVER_LOGGED_IN"),
      "register NEVER_LOGGED_IN atamalı"
    );
  });

  it("invite accept yeni kullanıcıya NEVER_LOGGED_IN atar", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "lib", "company-users-service.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("NEVER_LOGGED_IN"),
      "invite accept NEVER_LOGGED_IN atamalı"
    );
  });
});
