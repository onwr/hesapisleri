import "server-only";

import type { CompanyOnboarding, CompanyOnboardingStatus, Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { getNewCompanyDefaults } from "@/lib/admin/platform-settings/platform-settings-loader";
import { getPlatformLegalInfo } from "@/lib/legal/platform-legal-info";
import { db } from "@/lib/prisma";
import { canManageSettings } from "@/lib/permission-utils";
import { getDashboardCacheTag } from "@/lib/dashboard-cache-tags";
import { getOnboardingCacheTag } from "@/lib/onboarding/onboarding-cache";
import {
  buildOnboardingChecklist,
  calculateChecklistProgressPercent,
  getOnboardingMilestonesUncached,
} from "@/lib/onboarding/onboarding-progress";
import {
  ONBOARDING_FLOW_VERSION,
  ONBOARDING_MAX_STEP,
  type OnboardingProgressPatchInput,
} from "@/lib/onboarding/onboarding-schemas";
import { isCompanyProfileComplete } from "@/lib/onboarding/onboarding-company-utils";
import { shouldForceOnboardingRedirect } from "@/lib/onboarding/onboarding-redirect";

export class OnboardingServiceError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "OnboardingServiceError";
    this.status = status;
    this.code = code;
  }
}

type OnboardingActor = {
  userId: string;
  companyId: string;
  effectiveRole: string;
  isOwner: boolean;
  isSuperAdmin: boolean;
};

function invalidateOnboardingCaches(companyId: string) {
  revalidateTag(getOnboardingCacheTag(companyId), "max");
  revalidateTag(getDashboardCacheTag(companyId), "max");
}

async function writeOnboardingAudit(input: {
  companyId: string;
  userId: string;
  action: string;
  entityId: string;
  step?: number;
  flowVersion?: number;
}) {
  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      module: "onboarding",
      message: "Firma onboarding işlemi kaydedildi.",
      entityType: "CompanyOnboarding",
      entityId: input.entityId,
      metadata: {
        step: input.step,
        flowVersion: input.flowVersion ?? ONBOARDING_FLOW_VERSION,
      },
    },
  });
}

async function isEstablishedCompany(companyId: string) {
  const [productCount, saleCount, customerCount] = await Promise.all([
    db.product.count({ where: { companyId } }),
    db.sale.count({ where: { companyId } }),
    db.customer.count({ where: { companyId } }),
  ]);

  return productCount > 0 || saleCount > 0 || customerCount > 0;
}

export async function createOnboardingForNewCompany(
  tx: Prisma.TransactionClient,
  companyId: string
) {
  await tx.companyOnboarding.create({
    data: {
      companyId,
      status: "NOT_STARTED",
      currentStep: 1,
      flowVersion: ONBOARDING_FLOW_VERSION,
    },
  });
}

export async function getOrCreateCompanyOnboarding(
  companyId: string
): Promise<CompanyOnboarding> {
  const existing = await db.companyOnboarding.findUnique({
    where: { companyId },
  });

  if (existing) {
    return existing;
  }

  const established = await isEstablishedCompany(companyId);
  const now = new Date();

  try {
    return await db.companyOnboarding.create({
      data: {
        companyId,
        status: "COMPLETED",
        currentStep: ONBOARDING_MAX_STEP,
        flowVersion: ONBOARDING_FLOW_VERSION,
        completedAt: established ? now : null,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const raced = await db.companyOnboarding.findUnique({
        where: { companyId },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function ensureCompanyOperationalDefaults(companyId: string) {
  const [warehouseCount, cashCount, settings] = await Promise.all([
    db.warehouse.count({
      where: { companyId, status: "ACTIVE" },
    }),
    db.account.count({
      where: { companyId, type: "CASH", status: "ACTIVE" },
    }),
    db.companySettings.findUnique({
      where: { companyId },
      select: { id: true },
    }),
  ]);

  if (warehouseCount > 0 && cashCount > 0 && settings) {
    return { created: false };
  }

  const defaults = await getNewCompanyDefaults();
  const currency = defaults.currency;

  await db.$transaction(async (tx) => {
    if (warehouseCount === 0) {
      const existingDefault = await tx.warehouse.findFirst({
        where: { companyId, isDefault: true },
        select: { id: true },
      });

      if (!existingDefault) {
        await tx.warehouse.create({
          data: {
            companyId,
            name: "Ana Depo",
            code: "MAIN",
            isDefault: true,
            status: "ACTIVE",
          },
        });
      }
    }

    if (cashCount === 0) {
      const existingCash = await tx.account.findFirst({
        where: { companyId, type: "CASH", status: "ACTIVE" },
        select: { id: true },
      });

      if (!existingCash) {
        await tx.account.create({
          data: {
            companyId,
            type: "CASH",
            name: "Merkez Kasa",
            balance: 0,
            currency,
            status: "ACTIVE",
            isDefault: true,
          },
        });
      }
    }

    if (!settings) {
      await tx.companySettings.create({
        data: {
          companyId,
          currency,
          defaultVatRate: defaults.defaultVatRate,
          defaultInvoiceType: "E_ARCHIVE",
          invoiceNumberPrefix: "FTR",
          defaultDueDays: 30,
          autoCreateCashAccount: true,
          hideInactiveAccounts: true,
          notifyLowStock: defaults.notifyLowStock,
          notifyDueInvoices: defaults.notifyDueInvoices,
          notifyLateCollections: defaults.notifyLateCollections,
          notifyDailySummary: defaults.notifyDailySummary,
          notifyEmployeePayments: defaults.notifyEmployeePayments,
        },
      });
    }
  });

  invalidateOnboardingCaches(companyId);
  return { created: true };
}

function assertCanManageOnboarding(actor: OnboardingActor) {
  if (
    !canManageSettings(
      actor.effectiveRole as Parameters<typeof canManageSettings>[0],
      actor.isOwner
    )
  ) {
    throw new OnboardingServiceError("Bu işlem için yetkiniz yok.", 403);
  }
}

export function assertCanManageCompanyOnboarding(actor: OnboardingActor) {
  assertCanManageOnboarding(actor);
}

async function assertOnboardingCompletionRequirements(companyId: string) {
  const [company, settings, milestones] = await Promise.all([
    db.company.findFirst({
      where: { id: companyId, status: "ACTIVE" },
      select: { id: true, name: true },
    }),
    db.companySettings.findUnique({
      where: { companyId },
      select: { id: true },
    }),
    getOnboardingMilestonesUncached(companyId),
  ]);

  if (!company) {
    throw new OnboardingServiceError("Aktif firma bulunamadı.", 404, "COMPANY_NOT_FOUND");
  }

  if (!isCompanyProfileComplete(company.name)) {
    throw new OnboardingServiceError(
      "Firma bilgileri tamamlanmadan onboarding bitirilemez.",
      400,
      "COMPANY_PROFILE_INCOMPLETE"
    );
  }

  if (!settings) {
    throw new OnboardingServiceError(
      "Firma ayarları hazır değil.",
      400,
      "COMPANY_SETTINGS_MISSING"
    );
  }

  if (!milestones.hasDefaultWarehouse || !milestones.hasDefaultCashAccount) {
    throw new OnboardingServiceError(
      "Operasyon kayıtları (depo/kasa) hazır değil.",
      400,
      "OPERATIONS_NOT_READY"
    );
  }
}

export async function validateOnboardingCompletionRequirements(companyId: string) {
  await assertOnboardingCompletionRequirements(companyId);
}

function assertMutableState(state: CompanyOnboarding) {
  if (state.status === "COMPLETED" || state.status === "DISMISSED") {
    throw new OnboardingServiceError(
      "Onboarding durumu bu işlem için uygun değil.",
      409,
      "INVALID_STATE"
    );
  }
}

export async function getOnboardingBundle(actor: OnboardingActor) {
  const state = await getOrCreateCompanyOnboarding(actor.companyId);
  const milestones = await getOnboardingMilestonesUncached(actor.companyId);
  const checklist = buildOnboardingChecklist(milestones);
  const legal = await getPlatformLegalInfo();

  return {
    state: serializeOnboardingState(state),
    milestones,
    checklist,
    checklistProgressPercent: calculateChecklistProgressPercent(checklist),
    checklistDismissed: Boolean(state.checklistDismissedAt),
    shouldRedirect: shouldForceOnboardingRedirect(state, actor.isSuperAdmin),
    supportEmail: legal.kvkkEmail,
    canManage: canManageSettings(
      actor.effectiveRole as Parameters<typeof canManageSettings>[0],
      actor.isOwner
    ),
  };
}

export async function startCompanyOnboarding(actor: OnboardingActor) {
  assertCanManageOnboarding(actor);

  const state = await getOrCreateCompanyOnboarding(actor.companyId);
  if (state.status !== "NOT_STARTED") {
    return serializeOnboardingState(state);
  }

  const updated = await db.companyOnboarding.update({
    where: { companyId: actor.companyId },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
      currentStep: 1,
      updatedByUserId: actor.userId,
    },
  });

  await writeOnboardingAudit({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "COMPANY_ONBOARDING_STARTED",
    entityId: updated.id,
    step: 1,
  });

  invalidateOnboardingCaches(actor.companyId);
  return serializeOnboardingState(updated);
}

export async function updateOnboardingProgress(
  actor: OnboardingActor,
  input: OnboardingProgressPatchInput
) {
  assertCanManageOnboarding(actor);

  const state = await getOrCreateCompanyOnboarding(actor.companyId);
  assertMutableState(state);

  if (input.currentStep < state.currentStep) {
    throw new OnboardingServiceError(
      "Onboarding adımı geriye alınamaz.",
      400,
      "STEP_REGRESSION"
    );
  }

  const nextStatus: CompanyOnboardingStatus =
    state.status === "NOT_STARTED" ? "IN_PROGRESS" : state.status;

  const updated = await db.companyOnboarding.update({
    where: { companyId: actor.companyId },
    data: {
      status: nextStatus,
      currentStep: input.currentStep,
      startedAt: state.startedAt ?? new Date(),
      updatedByUserId: actor.userId,
    },
  });

  if (input.currentStep > state.currentStep) {
    await writeOnboardingAudit({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "COMPANY_ONBOARDING_STEP_COMPLETED",
      entityId: updated.id,
      step: input.currentStep,
    });
  }

  invalidateOnboardingCaches(actor.companyId);
  return serializeOnboardingState(updated);
}

export async function completeCompanyOnboarding(actor: OnboardingActor) {
  assertCanManageOnboarding(actor);

  const state = await getOrCreateCompanyOnboarding(actor.companyId);
  if (state.status === "COMPLETED") {
    return serializeOnboardingState(state);
  }

  await assertOnboardingCompletionRequirements(actor.companyId);

  const updated = await db.companyOnboarding.update({
    where: { companyId: actor.companyId },
    data: {
      status: "COMPLETED",
      currentStep: ONBOARDING_MAX_STEP,
      completedAt: new Date(),
      updatedByUserId: actor.userId,
    },
  });

  await writeOnboardingAudit({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "COMPANY_ONBOARDING_COMPLETED",
    entityId: updated.id,
    step: ONBOARDING_MAX_STEP,
  });

  invalidateOnboardingCaches(actor.companyId);
  return serializeOnboardingState(updated);
}

export async function dismissCompanyOnboarding(actor: OnboardingActor) {
  assertCanManageOnboarding(actor);

  const state = await getOrCreateCompanyOnboarding(actor.companyId);
  if (state.status === "DISMISSED") {
    return serializeOnboardingState(state);
  }

  const wasActive =
    state.status === "NOT_STARTED" || state.status === "IN_PROGRESS";

  const updated = await db.companyOnboarding.update({
    where: { companyId: actor.companyId },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      updatedByUserId: actor.userId,
    },
  });

  if (wasActive) {
    await writeOnboardingAudit({
      companyId: actor.companyId,
      userId: actor.userId,
      action: "COMPANY_ONBOARDING_DISMISSED",
      entityId: updated.id,
      step: state.currentStep,
    });
  }

  invalidateOnboardingCaches(actor.companyId);
  return serializeOnboardingState(updated);
}

export async function reopenCompanyOnboarding(actor: OnboardingActor) {
  assertCanManageOnboarding(actor);

  const state = await getOrCreateCompanyOnboarding(actor.companyId);
  if (state.status === "IN_PROGRESS" || state.status === "NOT_STARTED") {
    return serializeOnboardingState(state);
  }

  const resumeStep =
    state.status === "COMPLETED"
      ? ONBOARDING_MAX_STEP
      : Math.min(state.currentStep || 1, ONBOARDING_MAX_STEP);

  const updated = await db.companyOnboarding.update({
    where: { companyId: actor.companyId },
    data: {
      status: "IN_PROGRESS",
      currentStep: resumeStep,
      dismissedAt: null,
      completedAt: null,
      updatedByUserId: actor.userId,
    },
  });

  await writeOnboardingAudit({
    companyId: actor.companyId,
    userId: actor.userId,
    action: "COMPANY_ONBOARDING_REOPENED",
    entityId: updated.id,
    step: resumeStep,
  });

  invalidateOnboardingCaches(actor.companyId);
  return serializeOnboardingState(updated);
}

export async function dismissOnboardingChecklist(actor: OnboardingActor) {
  assertCanManageOnboarding(actor);

  const state = await getOrCreateCompanyOnboarding(actor.companyId);

  if (state.checklistDismissedAt) {
    return serializeOnboardingState(state);
  }

  const updated = await db.companyOnboarding.update({
    where: { companyId: actor.companyId },
    data: {
      checklistDismissedAt: new Date(),
      updatedByUserId: actor.userId,
    },
  });

  invalidateOnboardingCaches(actor.companyId);
  return serializeOnboardingState(updated);
}

export async function reopenOnboardingChecklist(actor: OnboardingActor) {
  assertCanManageOnboarding(actor);

  const state = await getOrCreateCompanyOnboarding(actor.companyId);

  if (!state.checklistDismissedAt) {
    return serializeOnboardingState(state);
  }

  const updated = await db.companyOnboarding.update({
    where: { companyId: actor.companyId },
    data: {
      checklistDismissedAt: null,
      updatedByUserId: actor.userId,
    },
  });

  invalidateOnboardingCaches(actor.companyId);
  return serializeOnboardingState(updated);
}

export function serializeOnboardingState(state: CompanyOnboarding) {
  return {
    id: state.id,
    companyId: state.companyId,
    status: state.status,
    currentStep: state.currentStep,
    flowVersion: state.flowVersion,
    checklistDismissedAt: state.checklistDismissedAt?.toISOString() ?? null,
    startedAt: state.startedAt?.toISOString() ?? null,
    completedAt: state.completedAt?.toISOString() ?? null,
    dismissedAt: state.dismissedAt?.toISOString() ?? null,
  };
}

export async function getDashboardOnboardingChecklist(actor: OnboardingActor) {
  const state = await getOrCreateCompanyOnboarding(actor.companyId);
  const milestones = await getOnboardingMilestonesUncached(actor.companyId);
  const checklist = buildOnboardingChecklist(milestones);

  return {
    items: checklist,
    progressPercent: calculateChecklistProgressPercent(checklist),
    dismissed: Boolean(state.checklistDismissedAt),
    allComplete: checklist.every((item) => item.completed),
    showChecklist:
      !state.checklistDismissedAt &&
      !checklist.every((item) => item.completed) &&
      !shouldForceOnboardingRedirect(state, actor.isSuperAdmin),
  };
}
