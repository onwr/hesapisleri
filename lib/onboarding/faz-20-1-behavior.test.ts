import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { CompanyOnboarding } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  parseSafeInternalReturnTo,
  resolvePostCreateRedirect,
} from "@/lib/onboarding/onboarding-routes";
import {
  assertCanManageCompanyOnboarding,
  completeCompanyOnboarding,
  dismissCompanyOnboarding,
  dismissOnboardingChecklist,
  OnboardingServiceError,
  reopenCompanyOnboarding,
  updateOnboardingProgress,
  validateOnboardingCompletionRequirements,
} from "@/lib/onboarding/onboarding-service";
import { handleOnboardingApiError } from "@/lib/onboarding/onboarding-api";

const COMPANY_A = "clcompanyaaaaaaaaaaaaaaa";
const COMPANY_B = "clcompanybbbbbbbbbbbbbbb";

const OWNER_ACTOR = {
  userId: "user-owner",
  companyId: COMPANY_A,
  effectiveRole: "OWNER",
  isOwner: true,
  isSuperAdmin: false,
};

const ADMIN_ACTOR = {
  userId: "user-admin",
  companyId: COMPANY_A,
  effectiveRole: "ADMIN",
  isOwner: false,
  isSuperAdmin: false,
};

const STAFF_ACTOR = {
  userId: "user-staff",
  companyId: COMPANY_A,
  effectiveRole: "STAFF",
  isOwner: false,
  isSuperAdmin: false,
};

function baseOnboardingState(
  overrides: Partial<CompanyOnboarding> = {}
): CompanyOnboarding {
  return {
    id: "onb-1",
    companyId: COMPANY_A,
    status: "IN_PROGRESS",
    currentStep: 3,
    flowVersion: 1,
    checklistDismissedAt: null,
    startedAt: new Date("2026-01-01"),
    completedAt: null,
    dismissedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    updatedByUserId: null,
    ...overrides,
  };
}

function dbMock<T>(implementation: unknown): T {
  return implementation as T;
}

function mockMilestonesReady() {
  const originalCompanyFindFirst = db.company.findFirst.bind(db.company);
  const originalProductCount = db.product.count.bind(db.product);
  const originalStockCount = db.stockMovement.count.bind(db.stockMovement);
  const originalCustomerCount = db.customer.count.bind(db.customer);
  const originalSaleCount = db.sale.count.bind(db.sale);
  const originalIntegrationCount = db.marketplaceIntegration.count.bind(
    db.marketplaceIntegration
  );
  const originalTeamCount = db.companyUser.count.bind(db.companyUser);
  const originalWarehouseFindFirst = db.warehouse.findFirst.bind(db.warehouse);
  const originalAccountFindFirst = db.account.findFirst.bind(db.account);

  db.company.findFirst = dbMock<typeof db.company.findFirst>(
    async (args: { where?: { id?: string } }) => {
    if (args?.where?.id === COMPANY_A) {
      return { name: "Acme Ticaret" };
    }
    return null;
  });

  db.product.count = dbMock<typeof db.product.count>(async () => 0);
  db.stockMovement.count = dbMock<typeof db.stockMovement.count>(async () => 0);
  db.customer.count = dbMock<typeof db.customer.count>(async () => 0);
  db.sale.count = dbMock<typeof db.sale.count>(async () => 0);
  db.marketplaceIntegration.count = dbMock<typeof db.marketplaceIntegration.count>(
    async () => 0
  );
  db.companyUser.count = dbMock<typeof db.companyUser.count>(async () => 1);
  db.warehouse.findFirst = dbMock<typeof db.warehouse.findFirst>(
    async () => ({ id: "wh-1" })
  );
  db.account.findFirst = dbMock<typeof db.account.findFirst>(
    async () => ({ id: "cash-1" })
  );

  return () => {
    db.company.findFirst = originalCompanyFindFirst;
    db.product.count = originalProductCount;
    db.stockMovement.count = originalStockCount;
    db.customer.count = originalCustomerCount;
    db.sale.count = originalSaleCount;
    db.marketplaceIntegration.count = originalIntegrationCount;
    db.companyUser.count = originalTeamCount;
    db.warehouse.findFirst = originalWarehouseFindFirst;
    db.account.findFirst = originalAccountFindFirst;
  };
}

describe("Faz 20.1 parseSafeInternalReturnTo", () => {
  it("onboarding returnTo kabul edilir", () => {
    assert.equal(
      parseSafeInternalReturnTo("/onboarding", { fallback: "/products" }),
      "/onboarding"
    );
  });

  it("external absolute URL reddedilir", () => {
    assert.equal(
      parseSafeInternalReturnTo("https://evil.com/x", { fallback: "/products" }),
      "/products"
    );
  });

  it("protocol-relative URL reddedilir", () => {
    assert.equal(
      parseSafeInternalReturnTo("//evil.com", { fallback: "/customers" }),
      "/customers"
    );
  });

  it("encoded external URL reddedilir", () => {
    assert.equal(
      parseSafeInternalReturnTo(encodeURIComponent("https://evil.com"), {
        fallback: "/products",
      }),
      "/products"
    );
  });

  it("javascript scheme reddedilir", () => {
    assert.equal(
      parseSafeInternalReturnTo("javascript:alert(1)", { fallback: "/products" }),
      "/products"
    );
  });

  it("geçersiz allowlist fallback kullanır", () => {
    assert.equal(
      parseSafeInternalReturnTo("/evil/path", { fallback: "/products/abc?created=1" }),
      "/products/abc?created=1"
    );
  });
});

describe("Faz 20.1 resolvePostCreateRedirect", () => {
  it("product create güvenli returnTo ile onboarding döner", () => {
    assert.equal(
      resolvePostCreateRedirect({
        returnTo: "/onboarding",
        defaultDestination: "/products/p1?created=1",
      }),
      "/onboarding"
    );
  });

  it("customer create güvenli returnTo ile onboarding döner", () => {
    assert.equal(
      resolvePostCreateRedirect({
        returnTo: "/onboarding?step=4",
        defaultDestination: "/customers/c1?created=1",
      }),
      "/onboarding?step=4"
    );
  });

  it("geçersiz returnTo default destination kullanır", () => {
    assert.equal(
      resolvePostCreateRedirect({
        returnTo: "https://evil.com",
        defaultDestination: "/customers/c1?created=1",
      }),
      "/customers/c1?created=1"
    );
  });
});

describe("Faz 20.1 onboarding mutation yetkileri", () => {
  it("OWNER progress yapabilir", () => {
    assert.doesNotThrow(() => assertCanManageCompanyOnboarding(OWNER_ACTOR));
  });

  it("yetkili ADMIN yapabilir", () => {
    assert.doesNotThrow(() => assertCanManageCompanyOnboarding(ADMIN_ACTOR));
  });

  it("sınırlı çalışan mutation yapamaz", () => {
    assert.throws(
      () => assertCanManageCompanyOnboarding(STAFF_ACTOR),
      (error: unknown) =>
        error instanceof OnboardingServiceError && error.status === 403
    );
  });

  it("sınırlı çalışan complete yapamaz", async () => {
    let readState = false;
    const originalFindUnique = db.companyOnboarding.findUnique.bind(
      db.companyOnboarding
    );
    db.companyOnboarding.findUnique = dbMock<typeof db.companyOnboarding.findUnique>(
      async () => {
      readState = true;
      return baseOnboardingState({ status: "COMPLETED" });
    });

    try {
      await assert.rejects(
        () => completeCompanyOnboarding(STAFF_ACTOR),
        (error: unknown) =>
          error instanceof OnboardingServiceError && error.status === 403
      );
      assert.equal(readState, false);
    } finally {
      db.companyOnboarding.findUnique = originalFindUnique;
    }
  });

  it("sınırlı çalışan dismiss yapamaz", async () => {
    await assert.rejects(
      () => dismissCompanyOnboarding(STAFF_ACTOR),
      (error: unknown) =>
        error instanceof OnboardingServiceError && error.status === 403
    );
  });

  it("sınırlı çalışan reopen yapamaz", async () => {
    await assert.rejects(
      () => reopenCompanyOnboarding(STAFF_ACTOR),
      (error: unknown) =>
        error instanceof OnboardingServiceError && error.status === 403
    );
  });

  it("sınırlı çalışan checklist hide yapamaz", async () => {
    await assert.rejects(
      () => dismissOnboardingChecklist(STAFF_ACTOR),
      (error: unknown) =>
        error instanceof OnboardingServiceError && error.status === 403
    );
  });

  it("sınırlı çalışan progress yapamaz", async () => {
    await assert.rejects(
      () => updateOnboardingProgress(STAFF_ACTOR, { currentStep: 2 }),
      (error: unknown) =>
        error instanceof OnboardingServiceError && error.status === 403
    );
  });

  it("sınırlı çalışan onboarding okuyabilir", () => {
    const routeSrc = readFileSync(
      join(process.cwd(), "app/api/onboarding/route.ts"),
      "utf8"
    );
    const serviceSrc = readFileSync(
      join(process.cwd(), "lib/onboarding/onboarding-service.ts"),
      "utf8"
    );
    assert.ok(routeSrc.includes("getOnboardingBundle(auth.actor)"));
    assert.ok(routeSrc.includes("bundle.canManage"));
    assert.ok(!serviceSrc.includes("assertCanManageOnboarding(actor);\n\n  const state = await getOrCreateCompanyOnboarding(actor.companyId);\n  const milestones = await getOnboardingMilestonesUncached"));
    const getBundleStart = serviceSrc.indexOf("export async function getOnboardingBundle");
    const getBundleBody = serviceSrc.slice(getBundleStart, getBundleStart + 600);
    assert.ok(!getBundleBody.includes("assertCanManageOnboarding"));
  });
});

describe("Faz 20.1 completion doğrulaması", () => {
  it("eksik firma profili complete engeller", async () => {
    const restoreMilestones = mockMilestonesReady();
    const originalFindUnique = db.companyOnboarding.findUnique.bind(
      db.companyOnboarding
    );
    const originalCompanyFindFirst = db.company.findFirst.bind(db.company);
    const originalSettingsFindUnique = db.companySettings.findUnique.bind(
      db.companySettings
    );

    db.companyOnboarding.findUnique = dbMock<typeof db.companyOnboarding.findUnique>(
      async () => baseOnboardingState()
    );
    db.company.findFirst = dbMock<typeof db.company.findFirst>(async () => ({
      id: COMPANY_A,
      name: "İşletmem",
    }));
    db.companySettings.findUnique = dbMock<typeof db.companySettings.findUnique>(
      async () => ({
      id: "settings-1",
    })
    );

    try {
      await assert.rejects(
        () => validateOnboardingCompletionRequirements(COMPANY_A),
        (error: unknown) =>
          error instanceof OnboardingServiceError &&
          error.code === "COMPANY_PROFILE_INCOMPLETE"
      );
    } finally {
      db.companyOnboarding.findUnique = originalFindUnique;
      db.company.findFirst = originalCompanyFindFirst;
      db.companySettings.findUnique = originalSettingsFindUnique;
      restoreMilestones();
    }
  });

  it("optional milestone eksikken complete mümkündür", async () => {
    const restoreMilestones = mockMilestonesReady();
    const originalFindUnique = db.companyOnboarding.findUnique.bind(
      db.companyOnboarding
    );
    const originalUpdate = db.companyOnboarding.update.bind(db.companyOnboarding);
    const originalSettingsFindUnique = db.companySettings.findUnique.bind(
      db.companySettings
    );
    const originalActivityCreate = db.activityLog.create.bind(db.activityLog);

    db.companyOnboarding.findUnique = dbMock<typeof db.companyOnboarding.findUnique>(
      async () => baseOnboardingState()
    );
    db.companySettings.findUnique = dbMock<typeof db.companySettings.findUnique>(
      async () => ({
      id: "settings-1",
    })
    );
    db.companyOnboarding.update = dbMock<typeof db.companyOnboarding.update>(
      async (args: {
      where: { companyId: string };
      data: { status: string };
    }) => {
      assert.equal(args.where.companyId, COMPANY_A);
      assert.equal(args.data.status, "COMPLETED");
      throw new Error("TEST_STOP_BEFORE_CACHE");
    });
    db.activityLog.create = dbMock<typeof db.activityLog.create>(async () => ({}));

    const originalCompanyFindFirst = db.company.findFirst.bind(db.company);
    db.company.findFirst = dbMock<typeof db.company.findFirst>(
      async (args: { where?: { id?: string; status?: string } }) => {
      if (args?.where?.id === COMPANY_A) {
        return { id: COMPANY_A, name: "Acme Ticaret" };
      }
      return null;
    });

    try {
      await assert.rejects(
        () => completeCompanyOnboarding(OWNER_ACTOR),
        /TEST_STOP_BEFORE_CACHE/
      );
      await assert.doesNotReject(() =>
        validateOnboardingCompletionRequirements(COMPANY_A)
      );
    } finally {
      db.companyOnboarding.findUnique = originalFindUnique;
      db.companyOnboarding.update = originalUpdate;
      db.companySettings.findUnique = originalSettingsFindUnique;
      db.company.findFirst = originalCompanyFindFirst;
      db.activityLog.create = originalActivityCreate;
      restoreMilestones();
    }
  });

  it("ikinci complete idempotent", async () => {
    const originalFindUnique = db.companyOnboarding.findUnique.bind(
      db.companyOnboarding
    );
    const originalUpdate = db.companyOnboarding.update.bind(db.companyOnboarding);
    const originalCompanyFindFirst = db.company.findFirst.bind(db.company);
    let updateCalled = false;
    let requirementsChecked = false;

    db.companyOnboarding.findUnique = dbMock<typeof db.companyOnboarding.findUnique>(
      async () =>
      baseOnboardingState({
        status: "COMPLETED",
        currentStep: 5,
        completedAt: new Date("2026-02-01"),
      })
    );
    db.companyOnboarding.update = dbMock<typeof db.companyOnboarding.update>(async () => {
      updateCalled = true;
      return baseOnboardingState({ status: "COMPLETED" });
    });
    db.company.findFirst = dbMock<typeof db.company.findFirst>(async () => {
      requirementsChecked = true;
      return { id: COMPANY_A, name: "Acme Ticaret" };
    });

    try {
      const result = await completeCompanyOnboarding(OWNER_ACTOR);
      assert.equal(result.status, "COMPLETED");
      assert.equal(updateCalled, false);
      assert.equal(requirementsChecked, false);
    } finally {
      db.companyOnboarding.findUnique = originalFindUnique;
      db.companyOnboarding.update = originalUpdate;
      db.company.findFirst = originalCompanyFindFirst;
    }
  });

  it("başka firma onboarding kaydı etkilenmez", async () => {
    const restoreMilestones = mockMilestonesReady();
    const originalFindUnique = db.companyOnboarding.findUnique.bind(
      db.companyOnboarding
    );
    const originalUpdate = db.companyOnboarding.update.bind(db.companyOnboarding);
    const originalSettingsFindUnique = db.companySettings.findUnique.bind(
      db.companySettings
    );
    const originalActivityCreate = db.activityLog.create.bind(db.activityLog);
    let updatedCompanyId: string | undefined;

    db.companyOnboarding.findUnique = dbMock<typeof db.companyOnboarding.findUnique>(
      async (args: { where: { companyId: string } }) => {
      if (args.where.companyId === COMPANY_A) {
        return baseOnboardingState();
      }
      return null;
    });
    db.companySettings.findUnique = dbMock<typeof db.companySettings.findUnique>(
      async () => ({
      id: "settings-1",
    })
    );
    db.companyOnboarding.update = dbMock<typeof db.companyOnboarding.update>(
      async (args: { where: { companyId: string } }) => {
      updatedCompanyId = args.where.companyId;
      throw new Error("TEST_STOP_BEFORE_CACHE");
    });
    db.activityLog.create = dbMock<typeof db.activityLog.create>(async () => ({}));

    const originalCompanyFindFirst = db.company.findFirst.bind(db.company);
    db.company.findFirst = dbMock<typeof db.company.findFirst>(
      async (args: { where?: { id?: string } }) => {
      if (args?.where?.id === COMPANY_A) {
        return { id: COMPANY_A, name: "Acme Ticaret" };
      }
      return null;
    });

    try {
      await assert.rejects(
        () => completeCompanyOnboarding(OWNER_ACTOR),
        /TEST_STOP_BEFORE_CACHE/
      );
      assert.equal(updatedCompanyId, COMPANY_A);
      assert.notEqual(updatedCompanyId, COMPANY_B);
    } finally {
      db.companyOnboarding.findUnique = originalFindUnique;
      db.companyOnboarding.update = originalUpdate;
      db.companySettings.findUnique = originalSettingsFindUnique;
      db.company.findFirst = originalCompanyFindFirst;
      db.activityLog.create = originalActivityCreate;
      restoreMilestones();
    }
  });
});

describe("Faz 20.1 API route entegrasyonu", () => {
  it("complete route service katmanını kullanır", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/onboarding/complete/route.ts"),
      "utf8"
    );
    assert.ok(src.includes("completeCompanyOnboarding"));
    assert.ok(!src.includes("redirect"));
  });

  it("checklist route dismiss yetki kontrolünü service'e bırakır", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/onboarding/checklist/route.ts"),
      "utf8"
    );
    assert.ok(src.includes("dismissOnboardingChecklist"));
    assert.ok(src.includes("reopenOnboardingChecklist"));
  });

  it("403 onboarding api hatası durum sızdırmaz", async () => {
    const response = handleOnboardingApiError(
      new OnboardingServiceError("Bu işlem için yetkiniz yok.", 403)
    );
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.message, "Bu işlem için yetkiniz yok.");
  });
});

describe("Faz 20.1 form ve checklist UI", () => {
  it("new product form resolvePostCreateRedirect kullanır", () => {
    const src = readFileSync(
      join(process.cwd(), "components/products/new-product-form.tsx"),
      "utf8"
    );
    assert.ok(src.includes("resolvePostCreateRedirect"));
    assert.ok(src.includes("returnTo"));
  });

  it("new customer form resolvePostCreateRedirect kullanır", () => {
    const src = readFileSync(
      join(process.cwd(), "components/customers/new-customer-page.tsx"),
      "utf8"
    );
    assert.ok(src.includes("resolvePostCreateRedirect"));
    assert.ok(src.includes("NewCustomerPageClient"));
  });

  it("checklist hide metni şirket genelinde ve yalnız yetkili", () => {
    const src = readFileSync(
      join(process.cwd(), "components/dashboard/dashboard-start-checklist.tsx"),
      "utf8"
    );
    assert.ok(src.includes("şirket için gizle"));
    assert.ok(src.includes("canManage"));
    assert.ok(src.includes("Şirket genelinde görünür"));
  });

  it("onboarding wizard dismiss yalnız yetkili kullanıcıya açık", () => {
    const src = readFileSync(
      join(process.cwd(), "components/onboarding/onboarding-wizard.tsx"),
      "utf8"
    );
    assert.ok(src.includes("bundle?.canManage"));
    assert.ok(src.includes("handleDismiss"));
  });
});
