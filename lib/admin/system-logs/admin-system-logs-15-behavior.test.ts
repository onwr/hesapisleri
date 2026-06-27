/**
 * Faz 15 — Sistem logları davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import { maskIp } from "@/lib/admin/plans/admin-plan-activity-scope";
import {
  REDACTED_PLACEHOLDER,
  buildSystemLogWhere,
  classifyLogResult,
  classifyLogSource,
  isLegacyLog,
  isStructuredLog,
  parseSystemLogListFilters,
  redactSystemLogMetadata,
  redactSystemLogRecursive,
  redactSystemLogValue,
  resolveEntityAdminHref,
  SYSTEM_LOG_PAGE_SIZES,
} from "@/lib/admin/system-logs";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

describe("pagination ve filtre parse", () => {
  it("pagination 25/50/100", () => {
    assert.equal(parseSystemLogListFilters({ pageSize: "50" }).pageSize, 50);
    assert.equal(parseSystemLogListFilters({ pageSize: "99" }).pageSize, 25);
    assert.deepEqual(SYSTEM_LOG_PAGE_SIZES, [25, 50, 100]);
  });

  it("arama min 2 karakter", () => {
    assert.equal(parseSystemLogListFilters({ q: "a" }).q, undefined);
    assert.equal(parseSystemLogListFilters({ q: "ab" }).q, "ab");
  });

  it("source ve scope filtreleri", () => {
    const f = parseSystemLogListFilters({
      source: "ADMIN",
      scope: "legacy",
      result: "error",
      sort: "created_asc",
    });
    assert.equal(f.source, "ADMIN");
    assert.equal(f.scope, "legacy");
    assert.equal(f.result, "error");
    assert.equal(f.sort, "created_asc");
  });

  it("buildSystemLogWhere arama OR", () => {
    const where = buildSystemLogWhere(
      parseSystemLogListFilters({ q: "login", page: "1", pageSize: "25" })
    );
    assert.ok("OR" in (where.AND as object[])[0]!);
  });
});

describe("structured entity scope", () => {
  it("structured entityType ve entityId", () => {
    assert.equal(
      isStructuredLog({ entityType: "MembershipPlan", entityId: "plan1" }),
      true
    );
    assert.equal(isLegacyLog({ entityType: null, entityId: "x" }), true);
    assert.equal(isLegacyLog({ entityType: "User", entityId: null }), true);
  });

  it("entity link mapping", () => {
    assert.equal(resolveEntityAdminHref("MembershipPlan", "p1"), "/admin/plans/p1");
    assert.equal(resolveEntityAdminHref("PartnerPayout", "pay1"), "/admin/partners/payouts/pay1");
    assert.equal(resolveEntityAdminHref("User", "u1"), "/admin/users/u1");
  });

  it("unknown entity link üretmez", () => {
    assert.equal(resolveEntityAdminHref("UnknownModel", "id1"), null);
    assert.equal(resolveEntityAdminHref("MembershipPlan", null), null);
  });

  it("legacy için entity link üretilmez", () => {
    const src = readSrc("lib/admin/system-logs/system-log-query-service.ts");
    assert.ok(src.includes("structured ? resolveEntityAdminHref"));
    assert.ok(!src.includes("message.includes"));
  });

  it("başka entity'ye yanlış link yok", () => {
    assert.equal(resolveEntityAdminHref("Company", "c1"), "/admin/companies/c1");
    assert.notEqual(resolveEntityAdminHref("Company", "c1"), "/admin/users/c1");
  });
});

describe("legacy log davranışı", () => {
  it("legacy etiketi structured olmayan kayıtlar", () => {
    const ui = readSrc("components/admin/system-logs/admin-system-logs-content.tsx");
    assert.ok(ui.includes('scope === "legacy"'));
    assert.ok(ui.includes("legacy"));
  });

  it("message parse ile entity ilişkisi kurulmaz", () => {
    const src = readSrc("lib/admin/system-logs/system-log-query-service.ts");
    assert.ok(!src.includes("JSON.parse(row.message"));
    assert.ok(!src.includes("message.match"));
  });
});

describe("redaction", () => {
  it("recursive object redaction", () => {
    const out = redactSystemLogRecursive({
      password: "secret",
      nested: { apiKey: "k", ok: "visible" },
    }) as Record<string, unknown>;
    assert.equal(out.password, REDACTED_PLACEHOLDER);
    assert.equal((out.nested as Record<string, unknown>).apiKey, REDACTED_PLACEHOLDER);
    assert.equal((out.nested as Record<string, unknown>).ok, "visible");
  });

  it("array redaction", () => {
    const out = redactSystemLogRecursive([{ token: "abc" }, { name: "ok" }]) as unknown[];
    assert.equal((out[0] as Record<string, unknown>).token, REDACTED_PLACEHOLDER);
    assert.equal((out[1] as Record<string, unknown>).name, "ok");
  });

  it("IP masking", () => {
    assert.equal(redactSystemLogValue("ip", "192.168.1.10"), maskIp("192.168.1.10"));
    assert.equal(maskIp("192.168.1.10"), "192.168.x.x");
  });

  it("IBAN key redacted", () => {
    assert.equal(redactSystemLogValue("iban", "TR330006100519786457841326"), REDACTED_PLACEHOLDER);
  });

  it("IBAN value pattern masked", () => {
    const out = redactSystemLogValue("note", "TR330006100519786457841326");
    assert.equal(out, "TR33****1326");
  });

  it("detail redacted metadata", () => {
    const meta = redactSystemLogMetadata({
      reason: "test",
      authorization: "Bearer x",
      diff: { password: "p" },
    });
    assert.equal(meta?.authorization, REDACTED_PLACEHOLDER);
    assert.equal((meta?.diff as Record<string, unknown>).password, REDACTED_PLACEHOLDER);
    assert.equal(meta?.reason, "test");
  });

  it("CSV redaction — ham metadata yok", () => {
    const exportSrc = readSrc("lib/admin/system-logs/system-log-export-service.ts");
    assert.ok(!exportSrc.includes("metadata:"));
    assert.ok(exportSrc.includes("serializeSystemLogCsvRow"));
    const querySrc = readSrc("lib/admin/system-logs/system-log-query-service.ts");
    assert.ok(querySrc.includes("maskEntityIdForExport"));
    assert.ok(querySrc.includes("redactSystemLogMessage"));
  });
});

describe("performans — listede metadata seçilmez", () => {
  it("LIST_SELECT metadata içermez", () => {
    const src = readSrc("lib/admin/system-logs/system-log-query-service.ts");
    const block = src.slice(src.indexOf("const LIST_SELECT"), src.indexOf("type ListRow"));
    assert.ok(!block.includes("metadata: true"));
    assert.ok(block.includes("message: true"));
  });

  it("detail endpoint metadata okur", () => {
    const src = readSrc("lib/admin/system-logs/system-log-query-service.ts");
    assert.ok(src.includes("redactSystemLogMetadata(row.metadata)"));
  });
});

describe("source sınıflandırması", () => {
  it("ADMIN modül prefix", () => {
    assert.equal(
      classifyLogSource({
        module: "admin-plans",
        action: "PLAN_UPDATED",
        userId: "u1",
        companyId: null,
        entityType: "MembershipPlan",
        entityId: "p1",
        metadata: null,
      }),
      "ADMIN"
    );
  });

  it("CRON metadata source", () => {
    assert.equal(
      classifyLogSource({
        module: "membership",
        action: "LIFECYCLE",
        userId: null,
        companyId: null,
        entityType: null,
        entityId: null,
        metadata: { source: "lifecycle-cron" },
      }),
      "CRON"
    );
  });

  it("TENANT company log", () => {
    assert.equal(
      classifyLogSource({
        module: "sales",
        action: "CREATE",
        userId: "u1",
        companyId: "c1",
        entityType: null,
        entityId: null,
        metadata: null,
      }),
      "TENANT"
    );
  });

  it("result error metadata", () => {
    assert.equal(
      classifyLogResult({
        module: "auth",
        action: "LOGIN",
        userId: "u1",
        companyId: null,
        entityType: null,
        entityId: null,
        metadata: { success: false },
      }),
      "error"
    );
  });
});

describe("auth ve mutation yok", () => {
  it("list route requireSuperAdminApi", () => {
    const src = readRoute(["admin", "system-logs"]);
    assert.match(src, /requireSuperAdminApi/);
    assert.match(src, /export async function GET/);
  });

  it("detail route requireSuperAdminApi", () => {
    const src = readRoute(["admin", "system-logs", "[id]"]);
    assert.match(src, /requireSuperAdminApi/);
  });

  it("export route requireSuperAdminApi", () => {
    const src = readRoute(["admin", "system-logs", "export"]);
    assert.match(src, /requireSuperAdminApi/);
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });

  it("update/delete endpointi yok", () => {
    const list = readRoute(["admin", "system-logs"]);
    const detail = readRoute(["admin", "system-logs", "[id]"]);
    assert.match(list, /405/);
    assert.match(detail, /DELETE/);
    assert.ok(!list.includes("activityLog.update"));
    assert.ok(!list.includes("activityLog.delete"));
  });
});

describe("schema indexleri", () => {
  it("ActivityLog performans indexleri", () => {
    const schema = readSrc("prisma/schema.prisma");
    assert.ok(schema.includes("@@index([createdAt])"));
    assert.ok(schema.includes("@@index([action, createdAt])"));
    assert.ok(schema.includes("@@index([companyId, createdAt])"));
    assert.ok(schema.includes("@@index([userId, createdAt])"));
  });
});
