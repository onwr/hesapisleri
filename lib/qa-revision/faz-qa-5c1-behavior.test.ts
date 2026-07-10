/**
 * QA Faz 5C.1 — auth güvenlik ve production kapanışı
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildZodValidationErrorBody,
} from "@/lib/api-zod-validation";
import {
  API_USER_ERROR_MESSAGES,
  humanizeZodFieldError,
  sanitizeUserFacingApiError,
} from "@/lib/api-user-error";
import {
  isBearerOnlyApiPath,
  shouldRejectUntrustedMutation,
} from "@/lib/api-origin-guard";
import { z } from "zod";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("Faz 5C.1 — Bearer bypass kaldırıldı", () => {
  it("genel Bearer exemption kaynakta yok", () => {
    const guard = readSrc("lib/api-origin-guard.ts");
    assert.doesNotMatch(guard, /authorization\?\.startsWith\("Bearer "\)/);
    assert.match(guard, /isBearerOnlyApiPath/);
    assert.match(guard, /BEARER_ONLY_API_PREFIXES/);
  });

  it("kötü origin + sahte Bearer + web mutation reddedilir", () => {
    process.env.MUTATION_ORIGIN_GUARD_DISABLED = undefined;
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/auth/switch-company",
        origin: "https://evil.example",
        referer: null,
        authorization: "Bearer attacker",
      }),
      true
    );
  });
});

describe("Faz 5C.1 — logout GET mutasyonu kaldırıldı", () => {
  it("clear-session GET 405 döner", () => {
    const route = readSrc("app/api/auth/clear-session/route.ts");
    assert.match(route, /status: 405/);
    assert.match(route, /Allow: "POST"/);
    assert.doesNotMatch(route, /getClearAuthCookieOptions/);
  });

  it("logout POST origin guard kullanır", () => {
    const route = readSrc("app/api/auth/logout/route.ts");
    assert.match(route, /verifyApiMutationOrigin/);
    assert.match(route, /export async function POST/);
  });

  it("logout butonları POST kullanır", () => {
    for (const file of [
      "components/layout/app-sidebar.tsx",
      "components/layout/app-user-menu.tsx",
      "components/pos/pos-staff-header.tsx",
    ]) {
      const src = readSrc(file);
      assert.match(src, /fetch\("\/api\/auth\/logout", \{ method: "POST" \}\)/);
    }
  });

  it("company select clear-session GET kullanmaz", () => {
    const src = readSrc("components/companies/company-select-screen.tsx");
    assert.doesNotMatch(src, /clear-session/);
    assert.match(src, /\/api\/auth\/logout/);
  });
});

describe("Faz 5C.1 — sessionVersion API doğrulaması", () => {
  it("requireAuthenticatedApiSession api-session üzerinden çalışır", () => {
    const src = readSrc("lib/module-access.ts");
    assert.match(src, /resolveAuthenticatedApiSession/);
    const apiSession = readSrc("lib/auth/api-session.ts");
    assert.match(apiSession, /payload\.sv === undefined \|\| payload\.sv !== user\.sessionVersion/);
  });
});

describe("Faz 5C.1 — Türkçe kullanıcı hataları", () => {
  it("ürün validation Türkçe", () => {
    const schema = z.object({
      name: z.string().min(2, "Ürün adı en az 2 karakter olmalıdır."),
    });
    const parsed = schema.safeParse({ name: "A" });
    assert.equal(parsed.success, false);
    const body = buildZodValidationErrorBody(parsed.error!);
    assert.match(body.message, /Ürün adı|çok kısa/i);
    assert.doesNotMatch(body.errors.name?.[0] ?? "", /Too small|String must/i);
  });

  it("tedarikçi e-posta validation Türkçe", () => {
    const schema = z.object({
      email: z.string().email("Geçerli bir e-posta girin.").optional().or(z.literal("")),
    });
    const parsed = schema.safeParse({ email: "bad" });
    assert.equal(parsed.success, false);
    const body = buildZodValidationErrorBody(parsed.error!);
    assert.match(body.message, /e-posta/i);
  });

  it("permission ve not-found canonical mesajlar Türkçe", () => {
    assert.match(API_USER_ERROR_MESSAGES.FORBIDDEN, /yetkiniz/i);
    assert.match(API_USER_ERROR_MESSAGES.NOT_FOUND, /bulunamadı/i);
  });

  it("Prisma ham mesajı UI'ya sızmaz", () => {
    const message = sanitizeUserFacingApiError(
      new Error(
        "Invalid `prisma.user.findUnique()` invocation: Unique constraint failed on the fields: (`email`)"
      )
    );
    assert.equal(message, API_USER_ERROR_MESSAGES.INTERNAL_ERROR);
  });

  it("İngilizce Required Türkçeleştirilir", () => {
    assert.equal(humanizeZodFieldError("email", "Required"), "Bu alan zorunludur.");
  });
});

describe("Faz 5C.1 — origin production davranışı", () => {
  it("NODE_ENV=test guard'ı otomatik kapatmaz", () => {
    const guard = readSrc("lib/api-origin-guard.ts");
    assert.doesNotMatch(guard, /NODE_ENV === "test"/);
    assert.match(guard, /MUTATION_ORIGIN_GUARD_DISABLED/);
  });

  it("production'da localhost allowlist yok", () => {
    const guard = readSrc("lib/api-origin-guard.ts");
    assert.match(guard, /isProduction[\s\S]*\[\]/);
  });
});

describe("Faz 5C.1 — nginx operasyon dokümanı", () => {
  it("yedek, nginx -t, reload ve curl adımları mevcut", () => {
    const doc = readSrc("docs/production/nginx-security.md");
    assert.match(doc, /nginx\.conf\.bak/);
    assert.match(doc, /server_tokens off/);
    assert.match(doc, /sudo nginx -t/);
    assert.match(doc, /systemctl reload nginx/);
    assert.match(doc, /curl -I https:\/\/hesapisleri\.com/);
    assert.match(doc, /olmayan-sayfa/);
  });
});

describe("Faz 5C.1 — canonical build script", () => {
  it("prisma-generate-safe schema hash cache kullanır", () => {
    const script = readSrc("scripts/prisma-generate-safe.mjs");
    assert.match(script, /\.prisma-generate-hash/);
    assert.match(script, /getSchemaHash/);
  });
});

describe("Faz 5C.1 — bearer-only sınıflandırma", () => {
  it("mobile route bearer-only", () => {
    assert.equal(isBearerOnlyApiPath("/api/mobile/pos/sales"), true);
    assert.equal(isBearerOnlyApiPath("/api/billing/sipay/checkout"), false);
  });
});
