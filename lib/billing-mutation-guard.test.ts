/**
 * Kanonik billing mutation guard (assertCanManageActiveCompanyBilling) —
 * kaynak tarama + (TEST_DATABASE_URL varsa) gerçek DB davranış testleri.
 *
 * UI gizlemesi TEK koruma değildir; asıl güvenlik sınırı bu guard'ın TÜM
 * billing mutation route'larında çağrılmasıdır.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";
import { PLATFORM_SETTINGS_DEFAULTS } from "@/lib/admin/platform-settings/platform-settings-defaults";
import { createCompanyForUser } from "@/lib/create-company-service";
import { db } from "@/lib/prisma";
import {
  assertCanManageActiveCompanyBilling,
  BillingOwnershipError,
} from "@/lib/membership-service";

const MUTATION_ROUTES = [
  "app/api/billing/payments/[id]/cancel/route.ts",
  "app/api/billing/payments/[id]/resume/route.ts",
  "app/api/billing/payments/[id]/retry/route.ts",
  "app/api/billing/subscription/auto-renew/route.ts",
  "app/api/billing/payment-methods/default/route.ts",
  "app/api/billing/payment-methods/[id]/route.ts",
  "app/api/billing/sipay/checkout/route.ts",
  "app/api/billing/sipay/finalize/route.ts",
  "app/api/billing/payments/paytr/initialize/route.ts",
  "app/api/billing/addons/initialize/route.ts",
  "app/api/billing/addons/[id]/route.ts",
];

describe("billing mutation route'ları — canonical guard çağrısı (kaynak tarama)", () => {
  for (const routePath of MUTATION_ROUTES) {
    it(`${routePath} assertCanManageActiveCompanyBilling çağırıyor`, async () => {
      const content = await fs.readFile(routePath, "utf8");
      assert.ok(
        content.includes("assertCanManageActiveCompanyBilling("),
        `${routePath} kanonik guard'ı çağırmıyor`
      );
    });
  }

  it("guard isSharedEntitlement veya sourceCompanyId!==activeCompanyId ise 403 fırlatıyor", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    const fnStart = content.indexOf(
      "export async function assertCanManageActiveCompanyBilling"
    );
    const fnBody = content.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes("entitlement.isSharedEntitlement"));
    assert.ok(
      fnBody.includes("entitlement.sourceCompanyId !== input.activeCompanyId")
    );
    assert.ok(fnBody.includes("throw new BillingOwnershipError()"));
  });

  it("BillingOwnershipError 403 ve 'başka bir firma üzerinden' mesajı taşıyor", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    const classStart = content.indexOf("export class BillingOwnershipError");
    const classBody = content.slice(classStart, classStart + 200);
    assert.ok(classBody.includes("403"));
    assert.ok(classBody.includes("başka bir firma üzerinden"));
  });
});

const dbTestOptions = process.env.TEST_DATABASE_URL
  ? {}
  : {
      skip:
        "TEST_DATABASE_URL tanımlı değil — gerçek DB entegrasyon testi atlandı.",
    };

describe(
  "assertCanManageActiveCompanyBilling — gerçek DB davranışı",
  dbTestOptions,
  () => {
    let ownerId: string;
    let companyAId: string;
    let companyBId: string;
    const userIds: string[] = [];
    const companyIds: string[] = [];

    async function createSmokeUser(label: string, stamp: string) {
      const user = await db.user.create({
        data: {
          email: `${label}-${stamp}@billing-guard.local`,
          password: "integration-test-only",
          name: `BillingGuard ${label}`,
          status: "ACTIVE",
        },
      });
      userIds.push(user.id);
      return user;
    }

    async function createSmokeCompany(userId: string, name: string) {
      const platformDefaults = {
        currency: PLATFORM_SETTINGS_DEFAULTS.defaultCurrency,
        defaultVatRate: PLATFORM_SETTINGS_DEFAULTS.defaultVatRate,
        trialDays: PLATFORM_SETTINGS_DEFAULTS.trialDays,
        trialAmount: PLATFORM_SETTINGS_DEFAULTS.trialAmount,
        notifyLowStock: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyLowStock,
        notifyDueInvoices: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyDueInvoices,
        notifyLateCollections:
          PLATFORM_SETTINGS_DEFAULTS.defaultNotifyLateCollections,
        notifyDailySummary: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyDailySummary,
        notifyEmployeePayments:
          PLATFORM_SETTINGS_DEFAULTS.defaultNotifyEmployeePayments,
      };
      const result = await db.$transaction((tx) =>
        createCompanyForUser(tx, {
          userId,
          name,
          source: "NEW_COMPANY",
          platformDefaults,
        })
      );
      companyIds.push(result.company.id);
      return result.company;
    }

    it("fixture kurulumu", async () => {
      const stamp = `billing-guard-${Date.now()}`;
      const owner = await createSmokeUser("owner", stamp);
      ownerId = owner.id;

      const companyA = await createSmokeCompany(ownerId, `Firma A ${stamp}`);
      companyAId = companyA.id;
      const companyB = await createSmokeCompany(ownerId, `Firma B ${stamp}`);
      companyBId = companyB.id;

      // companyA kendi aktif aboneliğine sahip (bootstrap TRIAL yeterli).
      // companyB'nin kendi aboneliği YOK — aynı kullanıcı üzerinden companyA'nın
      // aboneliğini "ödünç" kullanır (paylaşılan/borrowed entitlement senaryosu).
      await db.companySubscription.deleteMany({ where: { companyId: companyBId } });
    });

    it("shared entitlement (borrowing firma) → assertCanManageActiveCompanyBilling 403 fırlatır", async () => {
      await assert.rejects(
        () =>
          assertCanManageActiveCompanyBilling({
            userId: ownerId,
            activeCompanyId: companyBId,
          }),
        (err: unknown) => {
          assert.ok(err instanceof BillingOwnershipError);
          assert.equal((err as BillingOwnershipError).status, 403);
          return true;
        }
      );
    });

    it("source company (aboneliğin gerçek sahibi) üzerinden mutation guard'ı geçer", async () => {
      const entitlement = await assertCanManageActiveCompanyBilling({
        userId: ownerId,
        activeCompanyId: companyAId,
      });
      assert.equal(entitlement.canManageBilling, true);
      assert.equal(entitlement.sourceCompanyId, companyAId);
    });

    it("temizlik", async () => {
      for (const companyId of companyIds) {
        await db.company.deleteMany({ where: { id: companyId } }).catch(() => {});
      }
      for (const userId of userIds) {
        await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
      }
    });
  }
);
