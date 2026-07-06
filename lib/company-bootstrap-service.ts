import "server-only";

import { db } from "@/lib/prisma";
import { getNewCompanyDefaults } from "@/lib/admin/platform-settings/platform-settings-loader";
import { getDefaultMembershipPlan, MembershipServiceError } from "@/lib/membership-service";
import { createOnboardingForNewCompany } from "@/lib/onboarding/onboarding-service";

export type EnsureCompanyBootstrapInput = {
  userId: string;
  companyId: string;
};

export type EnsureCompanyBootstrapResult = {
  created: {
    companyUser: boolean;
    settings: boolean;
    warehouse: boolean;
    account: boolean;
    subscription: boolean;
    onboarding: boolean;
  };
};

/**
 * Idempotent "eksikleri tamamla" bootstrap servisi. Register/companies-new
 * akışındaki createCompanyForUser'ın YERİNE geçmez — o hâlâ yeni şirket
 * oluşturmanın tek canonical yoludur. Bu servis, daha önce eksik/bozuk
 * bootstrap verisiyle kalmış (repair script) VEYA plan katalog eksikliği
 * gibi geçici sebeplerle subscription'ı oluşmamış şirketleri güvenle
 * tamamlamak için var. Yalnız EKSİK kayıtları oluşturur, mevcut verileri
 * ezmez, farklı tenant verisini kullanmaz, tekrar çalıştırılabilir.
 */
export async function ensureCompanyBootstrap(
  input: EnsureCompanyBootstrapInput
): Promise<EnsureCompanyBootstrapResult> {
  const { userId, companyId } = input;

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) {
    throw new Error(`ensureCompanyBootstrap: company bulunamadı (${companyId})`);
  }

  const result: EnsureCompanyBootstrapResult = {
    created: {
      companyUser: false,
      settings: false,
      warehouse: false,
      account: false,
      subscription: false,
      onboarding: false,
    },
  };

  const [companyUser, settings, warehouse, account, subscription, onboarding] = await Promise.all([
    db.companyUser.findFirst({
      where: { companyId, userId },
      select: { id: true },
    }),
    db.companySettings.findUnique({ where: { companyId }, select: { id: true } }),
    db.warehouse.findFirst({
      where: { companyId, status: "ACTIVE" },
      select: { id: true },
    }),
    db.account.findFirst({
      where: { companyId, type: "CASH", status: "ACTIVE" },
      select: { id: true },
    }),
    db.companySubscription.findUnique({ where: { companyId }, select: { id: true } }),
    db.companyOnboarding.findUnique({ where: { companyId }, select: { id: true } }),
  ]);

  const defaults = await getNewCompanyDefaults();
  const currency = defaults.currency;

  await db.$transaction(async (tx) => {
    if (!companyUser) {
      // Yalnız bu user için, yalnız bu company scope'unda — başka tenant'a
      // ait CompanyUser'a dokunulmaz. Zaten OWNER varsa (başka bir userId ile)
      // bu yeni kayıt ekstra bir owner eklemez, mevcut owner'ı ezmez.
      const existingOwner = await tx.companyUser.findFirst({
        where: { companyId, isOwner: true },
        select: { id: true },
      });
      await tx.companyUser.create({
        data: {
          userId,
          companyId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: !existingOwner,
        },
      });
      result.created.companyUser = true;
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
      result.created.settings = true;
    }

    if (!warehouse) {
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
        result.created.warehouse = true;
      }
    }

    if (!account) {
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
        result.created.account = true;
      }
    }

    if (!subscription) {
      // Canonical default plan lookup reuse edildi — ayrı hard-coded "standard"
      // sorgusu YOK. Plan katalogda hâlâ yoksa subscription bu turda da
      // oluşturulmaz (idempotent — sonraki repair/bootstrap çalıştırmasında
      // plan eklenince tamamlanır); panel bunu zaten güvenle tolere ediyor.
      try {
        const plan = await getDefaultMembershipPlan();
        const now = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + defaults.trialDays);
        await tx.companySubscription.create({
          data: {
            companyId,
            planId: plan.id,
            status: "TRIAL",
            currentPeriodStart: now,
            currentPeriodEnd: trialEnd,
            trialEndsAt: trialEnd,
          },
        });
        result.created.subscription = true;
      } catch (error) {
        if (!(error instanceof MembershipServiceError)) {
          throw error;
        }
      }
    }

    if (!onboarding) {
      await createOnboardingForNewCompany(tx, companyId);
      result.created.onboarding = true;
    }
  });

  return result;
}
