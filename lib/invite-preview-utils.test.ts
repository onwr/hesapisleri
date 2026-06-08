import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveInvitePreviewMode } from "./invite-preview-utils";

describe("resolveInvitePreviewMode", () => {
  it("hesap yok → new_account", () => {
    const result = resolveInvitePreviewMode({
      inviteStatus: "PENDING",
      isExpired: false,
      isLoggedIn: false,
      loggedInEmail: null,
      inviteEmail: "yeni@firma.com",
      accountExists: false,
    });

    assert.equal(result.mode, "new_account");
    assert.equal(result.canAccept, true);
  });

  it("hesap var oturum yok → existing_account", () => {
    const result = resolveInvitePreviewMode({
      inviteStatus: "PENDING",
      isExpired: false,
      isLoggedIn: false,
      loggedInEmail: null,
      inviteEmail: "mevcut@firma.com",
      accountExists: true,
    });

    assert.equal(result.mode, "existing_account");
    assert.equal(result.canAccept, false);
  });

  it("oturum açık eşleşiyor → logged_in_match", () => {
    const result = resolveInvitePreviewMode({
      inviteStatus: "PENDING",
      isExpired: false,
      isLoggedIn: true,
      loggedInEmail: "Ali@Firma.com",
      inviteEmail: "ali@firma.com",
      accountExists: false,
    });

    assert.equal(result.mode, "logged_in_match");
    assert.equal(result.canAccept, true);
  });

  it("oturum açık eşleşmiyor → logged_in_mismatch", () => {
    const result = resolveInvitePreviewMode({
      inviteStatus: "PENDING",
      isExpired: false,
      isLoggedIn: true,
      loggedInEmail: "baska@firma.com",
      inviteEmail: "davet@firma.com",
      accountExists: false,
    });

    assert.equal(result.mode, "logged_in_mismatch");
    assert.equal(result.canAccept, false);
  });

  it("süresi dolmuş davet → expired", () => {
    const result = resolveInvitePreviewMode({
      inviteStatus: "EXPIRED",
      isExpired: true,
      isLoggedIn: false,
      loggedInEmail: null,
      inviteEmail: "davet@firma.com",
      accountExists: true,
    });

    assert.equal(result.mode, "expired");
    assert.equal(result.canAccept, false);
  });

  it("kabul edilmiş davet → already_accepted", () => {
    const result = resolveInvitePreviewMode({
      inviteStatus: "ACCEPTED",
      isExpired: false,
      isLoggedIn: true,
      loggedInEmail: "davet@firma.com",
      inviteEmail: "davet@firma.com",
      accountExists: true,
    });

    assert.equal(result.mode, "already_accepted");
    assert.equal(result.canAccept, false);
  });

  it("reddedilmiş davet → rejected", () => {
    const result = resolveInvitePreviewMode({
      inviteStatus: "REJECTED",
      isExpired: false,
      isLoggedIn: false,
      loggedInEmail: null,
      inviteEmail: "davet@firma.com",
      accountExists: false,
    });

    assert.equal(result.mode, "rejected");
    assert.equal(result.canAccept, false);
  });
});
