import type { Company, Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/settings-utils";

export const TRIAL_DAYS = 14;
export const TRIAL_AMOUNT = 1499;

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
};

export type CreateCompanyForUserResult = {
  company: Company;
};

function getNotificationContent(input: CreateCompanyForUserInput) {
  if (input.source === "REGISTER") {
    return {
      title: "Hesabınız oluşturuldu",
      message: input.registerCompanyNameProvided
        ? `Firma bilgilerinizle hesabınız açıldı. ${TRIAL_DAYS} gün ücretsiz deneme süreniz başladı.`
        : `Hesabınız açıldı. ${TRIAL_DAYS} gün ücretsiz deneme süreniz başladı. Firma bilgilerinizi panelden tamamlayabilirsiniz.`,
    };
  }

  return {
    title: "Yeni firma oluşturuldu",
    message: `${input.name.trim()} firması oluşturuldu. ${TRIAL_DAYS} gün ücretsiz deneme süreniz başladı.`,
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
  const currency = input.currency?.trim() || DEFAULT_COMPANY_SETTINGS.currency;
  const defaultVatRate =
    input.defaultVatRate ?? DEFAULT_COMPANY_SETTINGS.defaultVatRate;

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
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  await tx.membershipPayment.create({
    data: {
      companyId: company.id,
      periodStart: now,
      periodEnd: trialEnd,
      amount: TRIAL_AMOUNT,
      status: "PENDING",
      provider: "TRIAL",
      paymentRef: `TRIAL-${Date.now()}`,
      paidAt: null,
    },
  });

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
      ...DEFAULT_COMPANY_SETTINGS,
      currency,
      defaultVatRate,
      invoiceNoteTemplate: null,
    },
  });

  const notification = getNotificationContent(input);
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

  return { company };
}

export async function createCompanyForUserInTransaction(
  input: CreateCompanyForUserInput
): Promise<CreateCompanyForUserResult> {
  return db.$transaction(async (tx) => createCompanyForUser(tx, input));
}
