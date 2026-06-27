/**
 * Faz 11.1 — Partner note izolasyonu ve referral kod hata ayrımı
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminPartnerNoteCreateSchema,
  assertNoForbiddenPartnerPatchKeys,
  assertPartnerActivationAllowed,
} from "@/lib/admin/partners";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("referral code activation errors", () => {
  it("eksik kod REFERRAL_CODE_REQUIRED", () => {
    const result = assertPartnerActivationAllowed({
      partner: {
        id: "p1",
        status: "PASSIVE",
        email: "a@b.com",
        phone: "555",
        referralCode: "",
        commissionRate: { toString: () => "10" } as never,
        iban: null,
        payoutMethod: null,
        accountHolderName: null,
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.issues[0]?.code, "REFERRAL_CODE_REQUIRED");
    }
  });

  it("duplicate kod REFERRAL_CODE_ALREADY_EXISTS", () => {
    const result = assertPartnerActivationAllowed({
      partner: {
        id: "p1",
        status: "PASSIVE",
        email: "a@b.com",
        phone: "555",
        referralCode: "CODE1",
        commissionRate: { toString: () => "10" } as never,
        iban: null,
        payoutMethod: null,
        accountHolderName: null,
      },
      referralCodeDuplicate: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.issues[0]?.code, "REFERRAL_CODE_ALREADY_EXISTS");
    }
  });

  it("DUPLICATE_CODE aktivasyonda kullanılmaz", () => {
    const src = readSrc("lib/admin/partners/admin-partner-issue-service.ts");
    assert.ok(!src.includes('"DUPLICATE_CODE"'));
    assert.ok(src.includes("REFERRAL_CODE_REQUIRED"));
    assert.ok(src.includes("REFERRAL_CODE_ALREADY_EXISTS"));
  });

  it("create/update unique kontrolü transaction içinde", () => {
    const src = readSrc("lib/admin/partners/partner-mutation-service.ts");
    const createTx = src.slice(src.indexOf("export async function createPartner"), src.indexOf("export async function updatePartner"));
    const updateTx = src.slice(src.indexOf("export async function updatePartner"), src.indexOf("export async function activatePartner"));
    assert.ok(createTx.includes("$transaction"));
    assert.ok(createTx.includes("tx.partnerProfile.findFirst({ where: { referralCode } })"));
    assert.ok(updateTx.includes("referralCode: nextReferralCode, id: { not: id }"));
  });
});

describe("partner note isolation (service contract)", () => {
  it("listAdminPartnerNotes partnerId ile scope edilir", () => {
    const src = readSrc("lib/admin/partners/admin-partner-note-service.ts");
    assert.ok(src.includes("where: { partnerId, deletedAt: null }"));
  });

  it("mutation partnerId + noteId ile doğrulanır", () => {
    const src = readSrc("lib/admin/partners/admin-partner-note-service.ts");
    assert.ok(src.includes("where: { id: noteId, partnerId, deletedAt: null }"));
  });

  it("başka partner notu update/delete edilemez — partnerId route zorunlu", () => {
    const src = readSrc("lib/admin/partners/admin-partner-note-service.ts");
    assert.ok(src.includes("partnerId: string"));
    assert.ok(src.includes("noteId: string"));
    assert.ok(src.includes("where: { id: noteId, partnerId, deletedAt: null }"));
    const route = readSrc("app/api/admin/partners/[id]/notes/[noteId]/route.ts");
    assert.ok(route.includes("updateAdminPartnerNote(id, noteId"));
    assert.ok(route.includes("deleteAdminPartnerNote(id, noteId"));
  });

  it("soft deleted not düzenlenemez", () => {
    const src = readSrc("lib/admin/partners/admin-partner-note-service.ts");
    assert.ok(src.includes("deletedAt: null"));
    assert.ok(!src.includes("adminPartnerNote.delete("));
    assert.ok(src.includes("deletedAt: new Date()"));
  });

  it("authorUserId body'den alınmaz", () => {
    const parsed = adminPartnerNoteCreateSchema.safeParse({
      content: "test",
      authorUserId: "evil-user",
    });
    assert.equal(parsed.success, false);
    const src = readSrc("lib/admin/partners/admin-partner-note-service.ts");
    assert.ok(src.includes("authorUserId: actorUserId"));
    assert.ok(!src.includes("parsed.authorUserId"));
  });

  it("cache invalidation çalışır", () => {
    const src = readSrc("lib/admin/partners/admin-partner-note-service.ts");
    assert.ok(src.includes("invalidateAdminPartnerCaches(partnerId)"));
  });
});

describe("metadata edit security", () => {
  it("status PATCH reddedilir", () => {
    assert.throws(() => assertNoForbiddenPartnerPatchKeys({ status: "ACTIVE" }));
  });

  it("earnings ve payout alanları PATCH reddedilir", () => {
    assert.throws(() => assertNoForbiddenPartnerPatchKeys({ earnings: 100 }));
    assert.throws(() => assertNoForbiddenPartnerPatchKeys({ payout: {} }));
    assert.throws(() => assertNoForbiddenPartnerPatchKeys({ companyCount: 5 }));
  });

  it("detail overview düzenle modalı PATCH kullanır", () => {
    const modal = readSrc("components/admin/admin-partner-edit-modal.tsx");
    assert.ok(modal.includes("method: \"PATCH\""));
    assert.ok(modal.includes("adminPartnerUpdateSchema"));
    assert.ok(!modal.includes("earnings"));
    assert.ok(!modal.includes("companyCount"));
    assert.ok(modal.includes("readOnly = partner.status === \"ARCHIVED\""));
  });
});
