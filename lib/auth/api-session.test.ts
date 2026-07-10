import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBearerOnlyApiPath,
  isMutationOriginGuardDisabled,
  shouldRejectUntrustedMutation,
} from "@/lib/api-origin-guard";

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("api-session validation", () => {
  it("module-access requireAuthenticatedApiSession api-session kullanır", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/module-access.ts", "utf8");
    assert.match(src, /resolveAuthenticatedApiSession/);
    assert.doesNotMatch(src, /verifyToken<SessionAuthPayload>/);
  });

  it("api-session sessionVersion kontrolü içerir", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/auth/api-session.ts", "utf8");
    assert.match(src, /sessionVersion/);
    assert.match(src, /SESSION_REVOKED/);
  });
});

describe("bearer-only origin policy", () => {
  const originalGuard = process.env.MUTATION_ORIGIN_GUARD_DISABLED;
  const originalAppUrl = process.env.APP_URL;

  it("isBearerOnlyApiPath yalnız mobile route'larını işaretler", () => {
    assert.equal(isBearerOnlyApiPath("/api/mobile/catalog"), true);
    assert.equal(isBearerOnlyApiPath("/api/products/bulk"), false);
  });

  it("sahte Bearer web mutation origin bypass edemez", () => {
    process.env.MUTATION_ORIGIN_GUARD_DISABLED = undefined;
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/products/bulk",
        origin: "https://evil.example",
        referer: null,
        authorization: "Bearer fake-token",
      }),
      true
    );

    process.env.APP_URL = originalAppUrl;
    setNodeEnv("test");
    if (originalGuard === undefined) {
      delete process.env.MUTATION_ORIGIN_GUARD_DISABLED;
    } else {
      process.env.MUTATION_ORIGIN_GUARD_DISABLED = originalGuard;
    }
  });

  it("mobile bearer-only route origin olmadan geçer", () => {
    process.env.MUTATION_ORIGIN_GUARD_DISABLED = undefined;
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/mobile/sales",
        origin: null,
        referer: null,
        authorization: "Bearer mobile-token",
      }),
      false
    );

    process.env.APP_URL = originalAppUrl;
    setNodeEnv("test");
  });

  it("guard yalnız explicit env ile devre dışı kalır", () => {
    setNodeEnv("test");
    delete process.env.MUTATION_ORIGIN_GUARD_DISABLED;
    assert.equal(isMutationOriginGuardDisabled(), false);

    process.env.MUTATION_ORIGIN_GUARD_DISABLED = "true";
    assert.equal(isMutationOriginGuardDisabled(), true);
    delete process.env.MUTATION_ORIGIN_GUARD_DISABLED;
  });
});
