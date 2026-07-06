import type { Company, Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notification-service";
import { PLATFORM_SETTINGS_DEFAULTS } from "@/lib/admin/platform-settings/platform-settings-defaults";
import { getNewCompanyDefaults } from "@/lib/admin/platform-settings/platform-settings-loader";
import { DEFAULT_MEMBERSHIP_PLAN_CODE } from "@/lib/membership-service";
import { db } from "@/lib/prisma";
import { createOnboardingForNewCompany } from "@/lib/onboarding/onboarding-service";

/** @deprecated Test uyumluluğu için; runtime `getNewCompanyDefaults()` kullanın. */
export const TRIAL_DAYS = PLATFORM_SETTINGS_DEFAULTS.trialDays;
export const TRIAL_AMOUNT = PLATFORM_SETTINGS_DEFAULTS.trialAmount;

export type CreateCompanySource = "REGISTER" | "NEW_COMPANY";

export type CreateCompanyForUserInput = {
  userId: string;
  name: string;
  taxNo?: string | null;
  taxOffice?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  currency?: string;
  defaultVatRate?: number;
  source: CreateCompanySource;
  registerCompanyNameProvided?: boolean;
  platformDefaults?: Awaited<ReturnType<typeof getNewCompanyDefaults>>;
};

export type CreateCompanyForUserResult = {
  company: Company;
};

function getNotificationContent(
  input: CreateCompanyForUserInput,
  trialDays: number
) {
  if (input.source === "REGISTER") {
    return {
      title: "Hesabınız oluşturuldu",
      message: input.registerCompanyNameProvided
        ? `Firma bilgilerinizle hesabınız açıldı. ${trialDays} gün ücretsiz deneme süreniz başladı.`
        : `Hesabınız açıldı. ${trialDays} gün ücretsiz deneme süreniz başladı. Firma bilgilerinizi panelden tamamlayabilirsiniz.`,
    };
  }

  return {
    title: "Yeni firma oluşturuldu",
    message: `${input.name.trim()} firması oluşturuldu. ${trialDays} gün ücretsiz deneme süreniz başladı.`,
  };
}

function getActivityContent(source: CreateCompanySource) {
  if (source === "REGISTER") {
    return {
      action: "REGISTER",
      message: "Yeni kullanıcı kaydı oluşturuldu.",
    };
  }

  return {
    action: "CREATE_COMPANY",
    message: "Yeni firma oluşturuldu.",
  };
}

export async function createCompanyForUser(
  tx: Prisma.TransactionClient,
  input: CreateCompanyForUserInput
): Promise<CreateCompanyForUserResult> {
  const defaults = input.platformDefaults;
  if (!defaults) {
    throw new Error("platformDefaults zorunludur.");
  }
  const currency = input.currency?.trim() || defaults.currency;
  const defaultVatRate = input.defaultVatRate ?? defaults.defaultVatRate;
  const trialDays = defaults.trialDays;
  const trialAmount = defaults.trialAmount;

  const company = await tx.company.create({
    data: {
      name: input.name.trim(),
      taxNo: input.taxNo ?? null,
      taxOffice: input.taxOffice ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      logoUrl: input.logoUrl ?? null,
      status: "ACTIVE",
    },
  });

  await tx.companyUser.create({
    data: {
      userId: input.userId,
      companyId: company.id,
      role: "OWNER",
      status: "ACTIVE",
      isOwner: true,
    },
  });

  const now = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  await tx.membershipPayment.create({
    data: {
      companyId: company.id,
      periodStart: now,
      periodEnd: trialEnd,
      amount: trialAmount,
      status: "PENDING",
      provider: "TRIAL",
      paymentRef: `TRIAL-${Date.now()}`,
      paidAt: null,
    },
  });

  // Tek canonical plan-kodu sabiti (lib/membership-service.ts) reuse edildi —
  // ayrı bir hard-coded plan kodu literal'i burada TEKRAR yazılmadı.
  // Sorgu transaction (tx) scope'unda kalır — testlerde mock'lanan
  // tx ile uyumlu ve tüm bootstrap tek transaction'da tutarlı kalır. Plan
  // katalogda yoksa (ops/seed eksikliği) kayıt akışı YİNE DE tamamlanır;
  // subscription eksik kalır ama panel artık bunu güvenle tolere ediyor
  // (bkz. ensureCompanySubscriptionSafe / getSidebarMembershipSummary).
  const defaultPlan = await tx.membershipPlan.findFirst({
    where: { code: DEFAULT_MEMBERSHIP_PLAN_CODE, planStatus: "ACTIVE" },
  });

  if (defaultPlan) {
    await tx.companySubscription.create({
      data: {
        companyId: company.id,
        planId: defaultPlan.id,
        status: "TRIAL",
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        trialEndsAt: trialEnd,
      },
    });
  } else {
    console.error("COMPANY_BOOTSTRAP_DEFAULT_PLAN_MISSING", { companyId: company.id });
  }

  await tx.warehouse.create({
    data: {
      companyId: company.id,
      name: "Ana Depo",
      code: "MAIN",
      isDefault: true,
      status: "ACTIVE",
    },
  });

  await tx.account.createMany({
    data: [
      {
        companyId: company.id,
        type: "CASH",
        name: "Merkez Kasa",
        balance: 0,
        currency,
        status: "ACTIVE",
        isDefault: true,
      },
      {
        companyId: company.id,
        type: "BANK",
        name: "Banka Hesabı",
        bankName: "Varsayılan Banka",
        balance: 0,
        currency,
        status: "ACTIVE",
      },
    ],
  });

  await tx.companySettings.create({
    data: {
      companyId: company.id,
      currency,
      defaultVatRate,
      defaultInvoiceType: "E_ARCHIVE",
      invoiceNumberPrefix: "FTR",
      defaultDueDays: 30,
      invoiceNoteTemplate: null,
      defaultCollectionAccountId: null,
      defaultExpenseAccountId: null,
      autoCreateCashAccount: true,
      hideInactiveAccounts: true,
      notifyLowStock: defaults.notifyLowStock,
      notifyDueInvoices: defaults.notifyDueInvoices,
      notifyLateCollections: defaults.notifyLateCollections,
      notifyDailySummary: defaults.notifyDailySummary,
      notifyEmployeePayments: defaults.notifyEmployeePayments,
    },
  });

  const notification = getNotificationContent(input, trialDays);
  const activity = getActivityContent(input.source);

  await createNotification(
    {
      companyId: company.id,
      userId: input.userId,
      type: "SUCCESS",
      category: "SYSTEM",
      module: "settings",
      entityType: "COMPANY",
      entityId: company.id,
      actionUrl: "/settings",
      title: notification.title,
      message: notification.message,
    },
    tx
  );

  await tx.activityLog.create({
    data: {
      companyId: company.id,
      userId: input.userId,
      action: activity.action,
      module: "auth",
      message: activity.message,
    },
  });

  await createOnboardingForNewCompany(tx, company.id);

  return { company };
}

export async function createCompanyForUserInTransaction(
  input: CreateCompanyForUserInput
): Promise<CreateCompanyForUserResult> {
  const platformDefaults = await getNewCompanyDefaults();
  return db.$transaction(async (tx) =>
    createCompanyForUser(tx, { ...input, platformDefaults })
  );
}
