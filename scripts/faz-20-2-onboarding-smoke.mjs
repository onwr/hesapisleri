import Module from "node:module";

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only" || request === "next/cache") {
    return {
      revalidateTag: () => {},
      revalidatePath: () => {},
      unstable_cache: (fn) => fn,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

async function run() {
  const assert = (await import("node:assert/strict")).default;
  const { db } = await import("@/lib/prisma");
  const { PLATFORM_SETTINGS_DEFAULTS } = await import(
    "@/lib/admin/platform-settings/platform-settings-defaults"
  );
  const { createCompanyForUser } = await import("@/lib/create-company-service");
  const {
    completeCompanyOnboarding,
    getOrCreateCompanyOnboarding,
    OnboardingServiceError,
    startCompanyOnboarding,
    updateOnboardingProgress,
  } = await import("@/lib/onboarding/onboarding-service");
  const { resolvePostCreateRedirect } = await import(
    "@/lib/onboarding/onboarding-routes"
  );

  const stamp = `faz202-${Date.now()}`;
  const created = { userIds: [], companyIds: [] };

  function ownerActor(userId, companyId) {
    return {
      userId,
      companyId,
      effectiveRole: "OWNER",
      isOwner: true,
      isSuperAdmin: false,
    };
  }

  function staffActor(userId, companyId) {
    return {
      userId,
      companyId,
      effectiveRole: "STAFF",
      isOwner: false,
      isSuperAdmin: false,
    };
  }

  async function createSmokeUser(label) {
    const user = await db.user.create({
      data: {
        email: `${label}-${stamp}@smoke.local`,
        password: "smoke-test-only",
        name: `Smoke ${label}`,
        status: "ACTIVE",
      },
    });
    created.userIds.push(user.id);
    return user;
  }

  async function createSmokeCompany(userId, name) {
    const platformDefaults = {
      currency: PLATFORM_SETTINGS_DEFAULTS.defaultCurrency,
      defaultVatRate: PLATFORM_SETTINGS_DEFAULTS.defaultVatRate,
      trialDays: PLATFORM_SETTINGS_DEFAULTS.trialDays,
      trialAmount: PLATFORM_SETTINGS_DEFAULTS.trialAmount,
      notifyLowStock: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyLowStock,
      notifyDueInvoices: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyDueInvoices,
      notifyLateCollections: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyLateCollections,
      notifyDailySummary: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyDailySummary,
      notifyEmployeePayments: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyEmployeePayments,
    };
    const result = await db.$transaction(async (tx) =>
      createCompanyForUser(tx, {
        userId,
        name,
        source: "NEW_COMPANY",
        platformDefaults,
      })
    );
    created.companyIds.push(result.company.id);
    return result.company;
  }

  async function cleanup() {
    for (const companyId of created.companyIds) {
      await db.companyOnboarding.deleteMany({ where: { companyId } }).catch(() => {});
      await db.company.delete({ where: { id: companyId } }).catch(() => {});
    }
    for (const userId of created.userIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
  }

  console.log("Faz 20.2 onboarding smoke —", stamp);

  try {
    const ownerA = await createSmokeUser("owner-a");
    const ownerB = await createSmokeUser("owner-b");
    const staffA = await createSmokeUser("staff-a");

    const companyA = await createSmokeCompany(ownerA.id, `Smoke Firma A ${stamp}`);
    const companyB = await createSmokeCompany(ownerB.id, `Smoke Firma B ${stamp}`);

    await db.companyUser.create({
      data: {
        companyId: companyA.id,
        userId: staffA.id,
        role: "STAFF",
        status: "ACTIVE",
        isOwner: false,
      },
    });

    const onboardingA = await db.companyOnboarding.findUnique({
      where: { companyId: companyA.id },
    });
    assert.equal(onboardingA?.status, "NOT_STARTED");

    const started = await startCompanyOnboarding(ownerActor(ownerA.id, companyA.id));
    assert.equal(started.status, "IN_PROGRESS");

    await assert.rejects(
      () =>
        updateOnboardingProgress(staffActor(staffA.id, companyA.id), {
          currentStep: 2,
        }),
      (error) =>
        error instanceof OnboardingServiceError && error.status === 403
    );

    await db.company.update({
      where: { id: companyA.id },
      data: { name: `Acme Smoke ${stamp}` },
    });

    const progressed = await updateOnboardingProgress(
      ownerActor(ownerA.id, companyA.id),
      { currentStep: 5 }
    );
    assert.equal(progressed.currentStep, 5);

    const completed = await completeCompanyOnboarding(
      ownerActor(ownerA.id, companyA.id)
    );
    assert.equal(completed.status, "COMPLETED");

    const onboardingBBefore = await getOrCreateCompanyOnboarding(companyB.id);
    assert.equal(onboardingBBefore.status, "NOT_STARTED");

    assert.equal(
      resolvePostCreateRedirect({
        returnTo: "/onboarding",
        defaultDestination: "/products/p1?created=1",
      }),
      "/onboarding"
    );
    assert.equal(
      resolvePostCreateRedirect({
        returnTo: "/onboarding",
        defaultDestination: "/customers/c1?created=1",
      }),
      "/onboarding"
    );

    const onboardingBAfter = await db.companyOnboarding.findUnique({
      where: { companyId: companyB.id },
    });
    assert.equal(onboardingBAfter?.status, "NOT_STARTED");

    console.log("OK — tüm smoke kontrolleri geçti");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

run().catch((error) => {
  console.error("SMOKE FAILED", error);
  process.exit(1);
});
