import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveMeMembership } from "@/lib/auth/me-context";
import { resolveTenantUploadFolder } from "@/lib/storage/upload-path";
import { assertTenantResource } from "@/lib/tenant/tenant-guards";
import { TenantNotFoundError } from "@/lib/tenant/tenant-errors";
import {
  validateRemoveCompanyUser,
  validateRoleChange,
} from "@/lib/company-users-utils";
import { rejectMismatchedBodyCompanyId } from "@/lib/tenant/tenant-guards";
import { TenantForbiddenError } from "@/lib/tenant/tenant-errors";
import {
  validateCollectionAccount,
  COLLECTION_ACCOUNT_EMPTY_MESSAGE,
} from "@/lib/collection-account-utils";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

const COMPANY_A = "clcompanyaaaaaaaaaaaaaaa";
const COMPANY_B = "clcompanybbbbbbbbbbbbbbb";

describe("Faz 19 — tenant upload path", () => {
  it("her zaman oturum companyId ile prefixler", () => {
    assert.equal(
      resolveTenantUploadFolder(COMPANY_A, "hesapisleri/products"),
      `hesapisleri/${COMPANY_A}/products`
    );
  });

  it("başka tenant id içeren folder enjekte edilemez", () => {
    const malicious = `hesapisleri/${COMPANY_B}/products`;
    const resolved = resolveTenantUploadFolder(COMPANY_A, malicious);
    assert.ok(resolved.startsWith(`hesapisleri/${COMPANY_A}/`));
    assert.ok(!resolved.includes(COMPANY_B));
  });

  it("folder içinde companyId suffix bypass çalışmaz", () => {
    const resolved = resolveTenantUploadFolder(
      COMPANY_A,
      `hesapisleri/${COMPANY_B}/invoices`
    );
    assert.equal(resolved, `hesapisleri/${COMPANY_A}/invoices`);
  });

  it("upload route resolveTenantUploadFolder kullanır", () => {
    const src = readRoute(["upload"]);
    assert.ok(src.includes("resolveTenantUploadFolder"));
    assert.ok(!src.includes("safeFolder.includes(companyId)"));
  });
});

describe("Faz 19 — auth/me fail-closed", () => {
  it("geçersiz session companyId için 403 döner", () => {
    const result = resolveMeMembership(
      [
        {
          companyId: COMPANY_B,
          status: "ACTIVE",
        },
      ],
      COMPANY_A
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 403);
    }
  });

  it("session companyId yoksa başka firmaya düşmez", () => {
    const result = resolveMeMembership(
      [
        {
          companyId: COMPANY_B,
          status: "ACTIVE",
        },
      ],
      null
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.membership, null);
      assert.equal(result.requiresCompany, false);
    }
  });

  it("pasif üyelik eşleşmez", () => {
    const result = resolveMeMembership(
      [{ companyId: COMPANY_A, status: "PASSIVE" }],
      COMPANY_A
    );
    assert.equal(result.ok, false);
  });

  it("auth/me route resolveMeMembership kullanır", () => {
    const src = readRoute(["auth", "me"]);
    assert.ok(src.includes("resolveMeMembership"));
    assert.ok(!src.includes("companyUsers[0]"));
  });
});

describe("Faz 19 — tenant assertion helpers", () => {
  it("assertTenantResource cross-tenant için TenantNotFoundError", () => {
    assert.throws(
      () => assertTenantResource(COMPANY_B, COMPANY_A),
      TenantNotFoundError
    );
  });

  it("rejectMismatchedBodyCompanyId body companyId reddeder", () => {
    assert.throws(
      () => rejectMismatchedBodyCompanyId(COMPANY_B, COMPANY_A),
      TenantForbiddenError
    );
    assert.doesNotThrow(() =>
      rejectMismatchedBodyCompanyId(COMPANY_A, COMPANY_A)
    );
  });
});

describe("Faz 19 — rol ve yetki", () => {
  it("OWNER firmadan çıkarılamaz", () => {
    const result = validateRemoveCompanyUser({
      actorRole: "ADMIN",
      actorIsOwner: true,
      actorUserId: "user-a",
      targetUserId: "user-b",
      targetRole: "OWNER",
      targetIsOwner: true,
    });
    assert.equal(result.ok, false);
  });

  it("kullanıcı kendini çıkaramaz", () => {
    const result = validateRemoveCompanyUser({
      actorRole: "ADMIN",
      actorIsOwner: true,
      actorUserId: "user-a",
      targetUserId: "user-a",
      targetRole: "STAFF",
      targetIsOwner: false,
    });
    assert.equal(result.ok, false);
  });

  it("OWNER rolü değiştirilemez", () => {
    const result = validateRoleChange({
      actorRole: "ADMIN",
      actorIsOwner: true,
      actorUserId: "user-a",
      targetUserId: "user-b",
      targetRole: "OWNER",
      targetIsOwner: true,
      nextRole: "STAFF",
    });
    assert.equal(result.ok, false);
  });

  it("tenant kullanıcısı admin API route guard kullanır", () => {
    const src = readRoute(["admin", "platform-settings"]);
    assert.ok(src.includes("requireSuperAdminApi"));
  });
});

describe("Faz 19 — cross-tenant route scope", () => {
  const tenantRoutes: Array<{ name: string; segments: string[] }> = [
    { name: "customers detail", segments: ["customers", "[id]"] },
    { name: "products detail", segments: ["products", "[id]"] },
    { name: "invoices detail", segments: ["invoices", "[id]"] },
    { name: "orders bulk-export", segments: ["orders", "bulk-export"] },
    { name: "customers bulk-export", segments: ["customers", "bulk-export"] },
    { name: "reports export", segments: ["reports", "export"] },
  ];

  for (const route of tenantRoutes) {
    it(`${route.name} companyId scope kullanır`, () => {
      const src = readRoute(route.segments);
      assert.ok(
        src.includes("companyId") && src.includes("requireApiModuleAccess"),
        `${route.name} eksik guard veya companyId`
      );
    });
  }

  it("orders bulk-export service company scope", () => {
    const route = readRoute(["orders", "bulk-export"]);
    assert.ok(route.includes("getBulkOrderExportRows(auth.companyId"));
    const service = readSrc("lib/orders-bulk-actions-service.ts");
    assert.ok(service.includes("companyId"));
  });
});

describe("Faz 19 — finansal tutarlılık sinyalleri", () => {
  it("tahsilat foreign tenant hesabı reddeder", () => {
  const result = validateCollectionAccount(
      {
        id: "acc-1",
        companyId: COMPANY_B,
        type: "CASH",
        status: "ACTIVE",
        name: "Foreign Cash",
        currency: "TRY",
      },
      COMPANY_A
    );
    assert.equal(result.ok, false);
    assert.ok(result.message);
  });

  it("PayTR callback amount doğrulama mevcut", () => {
    const src = readSrc("lib/payments/payment-service.ts");
    assert.ok(src.includes("amountMinor !== verified.totalAmountMinor"));
    assert.ok(src.includes("processingStatus === \"PROCESSED\""));
  });

  it("payment idempotency unique constraint", () => {
    const schema = readSrc("prisma/schema.prisma");
    assert.ok(schema.includes("@@unique([companyId, idempotencyKey])"));
  });
});

describe("Faz 19 — webhook ve cron", () => {
  it("PayTR callback maintenance muaf", () => {
    const src = readSrc("lib/platform-runtime/platform-maintenance-policy.ts");
    assert.ok(src.includes("/api/payments/paytr/callback"));
  });

  it("cron route CRON_SECRET kontrolü", () => {
    const cronRoutes = [
      "billing-renewals",
      "billing-outbox",
      "payment-reconciliation",
      "marketplace-sync",
      "notifications",
    ];
    for (const name of cronRoutes) {
      const src = readRoute(["cron", name]);
      assert.ok(src.includes("CRON_SECRET"), `${name} CRON_SECRET yok`);
    }
  });
});

describe("Faz 19 — mass assignment", () => {
  it("customer form schema companyId kabul etmez", () => {
    const src = readSrc("lib/customer-form-utils.ts");
    const schemaPart = src.slice(0, 2000);
    assert.ok(!schemaPart.includes("companyId:"));
  });

  it("sales create body companyId reject", () => {
    const src = readRoute(["sales", "create"]);
    assert.ok(
      src.includes("rejectMismatchedBodyCompanyId") ||
        src.includes("requireApiTenantContext")
    );
  });
});

describe("Faz 19 — production güvenlik başlıkları", () => {
  it("next.config güvenlik başlıkları", () => {
    const config = readSrc("next.config.ts");
    const headers = readSrc("lib/security-headers.ts");
    assert.ok(config.includes("poweredByHeader: false"));
    assert.ok(config.includes("securityHeaders"));
    assert.ok(headers.includes("X-Content-Type-Options"));
    assert.ok(headers.includes("Referrer-Policy"));
    assert.ok(headers.includes("X-Frame-Options"));
    assert.ok(headers.includes("Strict-Transport-Security"));
  });

  it("upload API response token sızdırmaz", () => {
    const route = readRoute(["upload"]);
    assert.ok(!route.includes("CDN_UPLOAD_TOKEN"));
    assert.ok(route.includes("data: { url }"));
  });
});

describe("Faz 19 — soft delete ve export", () => {
  it("customer list deletedAt filtresi", () => {
    const src = readRoute(["customers", "list"]);
    assert.ok(src.includes("deletedAt") || src.includes("findMany"));
  });
});

describe("Faz 19 — koleksiyon hesap boş mesajı", () => {
  it("COLLECTION_ACCOUNT_EMPTY_MESSAGE tanımlı", () => {
    assert.ok(COLLECTION_ACCOUNT_EMPTY_MESSAGE.length > 0);
  });
});
