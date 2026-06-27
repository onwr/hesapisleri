/**
 * Faz 12.1 — Legacy partner başvuru temizliği
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function fileExists(rel: string) {
  try {
    readFileSync(join(webRoot, rel));
    return true;
  } catch {
    return false;
  }
}

describe("legacy partner-service cleanup", () => {
  it("approvePartnerApplication kaldırıldı", () => {
    const src = readSrc("lib/partner-service.ts");
    assert.ok(!src.includes("export async function approvePartnerApplication"));
    assert.ok(!src.includes("export async function rejectPartnerApplication"));
    assert.ok(!src.includes("export async function listPartnerApplications"));
  });

  it("başvuru onay/red unstructured audit yok", () => {
    const src = readSrc("lib/partner-service.ts");
    assert.ok(!src.includes("Partner başvurusu onaylandı"));
    assert.ok(!src.includes("Partner başvurusu reddedildi"));
    assert.ok(!src.includes("applicationId: application.id"));
  });
});

describe("canonical bypass taraması", () => {
  it("legacy PATCH 405", () => {
    const src = readSrc("app/api/admin/partners/applications/[id]/route.ts");
    assert.ok(src.includes("405"));
    assert.ok(!src.includes("approvePartnerApplication"));
    assert.ok(!src.includes("rejectPartnerApplication"));
  });

  it("canonical approve route admin servisi kullanır", () => {
    const src = readSrc("app/api/admin/partner-applications/[id]/approve/route.ts");
    assert.ok(src.includes("approvePartnerApplicationAdmin"));
    assert.ok(!src.includes("partner-service"));
  });

  it("canonical reject route admin servisi kullanır", () => {
    const src = readSrc("app/api/admin/partner-applications/[id]/reject/route.ts");
    assert.ok(src.includes("rejectPartnerApplicationAdmin"));
    assert.ok(!src.includes("partner-service"));
  });

  it("legacy list re-export canonical GET", () => {
    const src = readSrc("app/api/admin/partners/applications/route.ts");
    assert.ok(src.includes("partner-applications/route"));
    assert.ok(!src.includes("partner-service"));
  });
});

describe("canonical approve/reject davranışı", () => {
  it("PASSIVE profil oluşturur", () => {
    const src = readSrc("lib/admin/partner-applications/application-mutation-service.ts");
    assert.ok(src.includes('status: "PASSIVE"'));
  });

  it("reject profil oluşturmaz", () => {
    const block = readSrc("lib/admin/partner-applications/application-mutation-service.ts").slice(
      readSrc("lib/admin/partner-applications/application-mutation-service.ts").indexOf(
        "export async function rejectPartnerApplicationAdmin"
      )
    );
    assert.ok(!block.includes("partnerProfile.create"));
  });

  it("structured audit kullanır", () => {
    const src = readSrc("lib/admin/partner-applications/application-mutation-service.ts");
    assert.ok(src.includes("logAdminPartnerApplicationAudit"));
    assert.ok(src.includes("PARTNER_APPLICATION_APPROVED"));
    assert.ok(src.includes("PARTNER_APPLICATION_REJECTED"));
    assert.ok(!src.includes('module: "admin"'));
  });
});

describe("ölü UI ve şemalar", () => {
  it("admin-partner-application-actions kaldırıldı", () => {
    assert.equal(fileExists("components/admin/admin-partner-application-actions.tsx"), false);
  });

  it("eski approve/reject şemaları kaldırıldı", () => {
    const utils = readSrc("lib/partner-utils.ts");
    assert.ok(!utils.includes("approvePartnerApplicationSchema"));
    assert.ok(!utils.includes("rejectPartnerApplicationSchema"));
  });

  it("applications sayfası ölü component import etmez", () => {
    const page = readSrc("app/admin/partners/applications/page.tsx");
    assert.ok(!page.includes("AdminPartnerApplicationActions"));
    assert.ok(!page.includes("partner-service"));
  });
});
