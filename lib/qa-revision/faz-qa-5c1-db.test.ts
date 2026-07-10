/**
 * QA Faz 5C.1 — sessionVersion DB doğrulaması
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { db } from "@/lib/prisma";
import { signSessionToken } from "@/lib/auth/jwt";
import { validateAuthenticatedApiSessionFromToken } from "@/lib/auth/api-session";

describe("QA Faz 5C.1 — sessionVersion DB integration", () => {
  it("matching sessionVersion geçer", async () => {
    const user = await db.user.create({
      data: {
        email: `sv-match-${Date.now()}@example.com`,
        name: "SV Match",
        password: "hashed",
        status: "ACTIVE",
        sessionVersion: 3,
      },
    });

    const token = signSessionToken(
      {
        userId: user.id,
        email: user.email,
        role: "USER",
        companyId: null,
        sv: 3,
      },
      1
    );

    const result = await validateAuthenticatedApiSessionFromToken(token);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.session.userId, user.id);
    }

    await db.user.delete({ where: { id: user.id } });
  });

  it("stale sessionVersion reddedilir", async () => {
    const user = await db.user.create({
      data: {
        email: `sv-stale-${Date.now()}@example.com`,
        name: "SV Stale",
        password: "hashed",
        status: "ACTIVE",
        sessionVersion: 5,
      },
    });

    const token = signSessionToken(
      {
        userId: user.id,
        email: user.email,
        role: "USER",
        companyId: null,
        sv: 4,
      },
      1
    );

    const result = await validateAuthenticatedApiSessionFromToken(token);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
      const body = await result.response.json();
      assert.equal(body.code, "SESSION_REVOKED");
    }

    await db.user.delete({ where: { id: user.id } });
  });

  it("inactive user reddedilir", async () => {
    const user = await db.user.create({
      data: {
        email: `sv-inactive-${Date.now()}@example.com`,
        name: "SV Inactive",
        password: "hashed",
        status: "SUSPENDED",
        sessionVersion: 1,
      },
    });

    const token = signSessionToken(
      {
        userId: user.id,
        email: user.email,
        role: "USER",
        companyId: null,
        sv: 1,
      },
      1
    );

    const result = await validateAuthenticatedApiSessionFromToken(token);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 403);
    }

    await db.user.delete({ where: { id: user.id } });
  });
});
