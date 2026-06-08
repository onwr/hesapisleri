import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInviteExpiryDate,
  buildInviteLink,
  isInviteExpired,
  normalizeInviteEmail,
  validateActorCanManageUsers,
  validateInviteTargetEmail,
  validateRemoveCompanyUser,
  validateRoleChange,
} from "./company-users-utils";

describe("company users utils", () => {
  it("OWNER davet oluşturabilir", () => {
    const result = validateActorCanManageUsers({
      actorRole: "OWNER",
      actorIsOwner: true,
    });
    assert.equal(result.ok, true);
  });

  it("ADMIN davet oluşturabilir", () => {
    const result = validateActorCanManageUsers({
      actorRole: "ADMIN",
      actorIsOwner: false,
    });
    assert.equal(result.ok, true);
  });

  it("STAFF davet oluşturamaz", () => {
    const result = validateActorCanManageUsers({
      actorRole: "STAFF",
      actorIsOwner: false,
    });
    assert.equal(result.ok, false);
  });

  it("aynı email şirketteyse davet engellenir", () => {
    const result = validateInviteTargetEmail({
      email: "Ali@Firma.com",
      existingMemberEmails: ["ali@firma.com"],
    });
    assert.equal(result.ok, false);
  });

  it("OWNER silinemez", () => {
    const result = validateRemoveCompanyUser({
      actorRole: "ADMIN",
      actorIsOwner: false,
      actorUserId: "user-admin",
      targetUserId: "user-owner",
      targetRole: "OWNER",
      targetIsOwner: true,
    });
    assert.equal(result.ok, false);
  });

  it("kullanıcı kendini silemez", () => {
    const result = validateRemoveCompanyUser({
      actorRole: "ADMIN",
      actorIsOwner: false,
      actorUserId: "user-1",
      targetUserId: "user-1",
      targetRole: "ADMIN",
      targetIsOwner: false,
    });
    assert.equal(result.ok, false);
  });

  it("OWNER rolü değiştirilemez", () => {
    const result = validateRoleChange({
      actorRole: "OWNER",
      actorIsOwner: true,
      actorUserId: "owner-1",
      targetUserId: "owner-1",
      targetRole: "OWNER",
      targetIsOwner: true,
      nextRole: "ADMIN",
    });
    assert.equal(result.ok, false);
  });

  it("ADMIN başka kullanıcının rolünü değiştirebilir", () => {
    const result = validateRoleChange({
      actorRole: "ADMIN",
      actorIsOwner: false,
      actorUserId: "admin-1",
      targetUserId: "staff-1",
      targetRole: "STAFF",
      targetIsOwner: false,
      nextRole: "ACCOUNTANT",
    });
    assert.equal(result.ok, true);
  });

  it("davet linki token içerir", () => {
    const link = buildInviteLink("abc123", "https://app.test");
    assert.match(link, /invite\?token=abc123/);
  });

  it("davet süresi 7 gün sonrasına ayarlanır", () => {
    const from = new Date("2026-06-04T10:00:00.000Z");
    const expiresAt = buildInviteExpiryDate(from);
    assert.equal(expiresAt.toISOString(), "2026-06-11T10:00:00.000Z");
  });

  it("süresi dolmuş davet algılanır", () => {
    assert.equal(
      isInviteExpired(new Date("2026-01-01"), new Date("2026-06-04")),
      true
    );
  });

  it("email normalize edilir", () => {
    assert.equal(normalizeInviteEmail("  Test@Mail.COM "), "test@mail.com");
  });
});
