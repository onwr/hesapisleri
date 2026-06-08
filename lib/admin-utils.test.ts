import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateSuperAdminRoleChange,
  validateUserStatusChange,
} from "./admin-utils";

describe("admin utils", () => {
  it("super admin kendi yetkisini kaldıramaz", () => {
    const result = validateSuperAdminRoleChange({
      actorUserId: "user-1",
      targetUserId: "user-1",
      nextRole: "OWNER",
    });

    assert.equal(result.ok, false);
  });

  it("super admin başka kullanıcıya yetki verebilir", () => {
    const result = validateSuperAdminRoleChange({
      actorUserId: "admin-1",
      targetUserId: "user-2",
      nextRole: "SUPER_ADMIN",
    });

    assert.equal(result.ok, true);
  });

  it("kullanıcı kendi hesabını pasife alamaz", () => {
    const result = validateUserStatusChange({
      actorUserId: "user-1",
      targetUserId: "user-1",
      nextStatus: "PASSIVE",
    });

    assert.equal(result.ok, false);
  });

  it("super admin başka kullanıcıyı pasife alabilir", () => {
    const result = validateUserStatusChange({
      actorUserId: "admin-1",
      targetUserId: "user-2",
      nextStatus: "PASSIVE",
    });

    assert.equal(result.ok, true);
  });
});
