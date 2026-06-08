import type { Company, CompanySettings, MembershipPayment } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  StorageConfigError,
  StorageUploadError,
  resolveUploadedImageUrl,
} from "@/lib/storage/cdn";
import {
  DEFAULT_COMPANY_SETTINGS,
  getUserRoleLabel,
  normalizeOptionalString,
  validateAccountBelongsToCompany,
  type UpdateCashBankSettingsInput,
  type UpdateCompanySettingsInput,
  type UpdateInvoiceSettingsInput,
  type UpdateNotificationSettingsInput,
} from "@/lib/settings-utils";

const CDN_COMPANY_FOLDER = "hesapisleri/companies";

export class SettingsAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "SettingsAccessError";
    this.status = status;
  }
}

export async function assertCompanyAccess(userId: string, companyId: string) {
  const companyUser = await db.companyUser.findFirst({
    where: {
      userId,
      companyId,
      status: "ACTIVE",
    },
  });

  if (!companyUser) {
    throw new SettingsAccessError("Bu firmaya erişim yetkiniz yok.");
  }

  return companyUser;
}

export async function ensureCompanySettings(companyId: string) {
  const existing = await db.companySettings.findUnique({
    where: { companyId },
  });

  if (existing) {
    return existing;
  }

  return db.companySettings.create({
    data: {
      companyId,
      ...DEFAULT_COMPANY_SETTINGS,
      invoiceNoteTemplate: null,
    },
  });
}

export type SerializedCompany = Omit<Company, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type SerializedCompanySettings = Omit<
  CompanySettings,
  | "monthlyFee"
  | "lastPaymentDate"
  | "nextPaymentDate"
  | "createdAt"
  | "updatedAt"
> & {
  monthlyFee: number;
  lastPaymentDate: string | null;
  nextPaymentDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeCompany(company: Company): SerializedCompany {
  return {
    ...company,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

export function serializeCompanySettings(
  settings: CompanySettings
): SerializedCompanySettings {
  return {
    ...settings,
    monthlyFee: Number(settings.monthlyFee),
    lastPaymentDate: settings.lastPaymentDate?.toISOString() ?? null,
    nextPaymentDate: settings.nextPaymentDate?.toISOString() ?? null,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export type SerializedSettingsBundle = {
  company: SerializedCompany;
  settings: SerializedCompanySettings;
  users: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    role: string;
    roleLabel: string;
    status: string;
    isOwner: boolean;
    joinedAt: string;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    balance: number;
  }>;
  membership: {
    status: string;
    statusLabel: string;
    lastPaymentDate: string | null;
    nextPaymentDate: string | null;
    amount: number | null;
    hasPackageSystem: false;
  };
};

function serializeMembership(membership: MembershipPayment | null) {
  const statusLabel =
    membership?.status === "PAID"
      ? "Aktif"
      : membership?.provider === "TRIAL"
        ? "Deneme"
        : membership
          ? "Bekliyor"
          : "Kayıt yok";

  return {
    status: membership?.status ?? "PENDING",
    statusLabel,
    lastPaymentDate: membership?.paidAt
      ? membership.paidAt.toISOString()
      : membership?.createdAt
        ? membership.createdAt.toISOString()
        : null,
    nextPaymentDate: membership?.periodEnd
      ? membership.periodEnd.toISOString()
      : null,
    amount: membership ? Number(membership.amount) : null,
    hasPackageSystem: false as const,
  };
}

export async function getSettingsBundle(
  companyId: string,
  userId: string
): Promise<SerializedSettingsBundle> {
  await assertCompanyAccess(userId, companyId);

  const [company, settings, companyUsers, accounts, membership] =
    await Promise.all([
      db.company.findUniqueOrThrow({ where: { id: companyId } }),
      ensureCompanySettings(companyId),
      db.companyUser.findMany({
        where: { companyId },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      }),
      db.account.findMany({
        where: { companyId },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      db.membershipPayment.findFirst({
        where: { companyId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    company: serializeCompany(company),
    settings: serializeCompanySettings(settings),
    users: companyUsers.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      name: entry.user.name,
      email: entry.user.email,
      role: entry.role,
      roleLabel: getUserRoleLabel(entry.role),
      status: entry.status,
      isOwner: entry.isOwner,
      joinedAt: entry.createdAt.toISOString(),
    })),
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      status: account.status,
      balance: Number(account.balance),
    })),
    membership: serializeMembership(membership),
  };
}

async function resolveLogoUrl(
  companyId: string,
  logoUrl?: string
) {
  if (!logoUrl) return null;

  return resolveUploadedImageUrl(
    logoUrl,
    `${CDN_COMPANY_FOLDER}/${companyId}`
  );
}

export async function updateCompanySettings(input: {
  companyId: string;
  userId: string;
  data: UpdateCompanySettingsInput;
}) {
  await assertCompanyAccess(input.userId, input.companyId);

  const {
    name,
    phone,
    email,
    taxNo,
    taxOffice,
    address,
    logoUrl,
    currency,
    defaultVatRate,
  } = input.data;

  let resolvedLogoUrl: string | null | undefined;

  try {
    resolvedLogoUrl =
      logoUrl !== undefined
        ? logoUrl
          ? await resolveLogoUrl(input.companyId, logoUrl)
          : null
        : undefined;
  } catch (error) {
    if (
      error instanceof StorageConfigError ||
      error instanceof StorageUploadError
    ) {
      throw error;
    }

    if (error instanceof Error && error.message.includes("yükleyebilirsiniz")) {
      throw error;
    }

    throw error;
  }

  const [company, settings] = await db.$transaction(async (tx) => {
    const updatedCompany = await tx.company.update({
      where: { id: input.companyId },
      data: {
        name,
        phone: normalizeOptionalString(phone),
        email: normalizeOptionalString(email),
        taxNo: normalizeOptionalString(taxNo),
        taxOffice: normalizeOptionalString(taxOffice),
        address: normalizeOptionalString(address),
        ...(resolvedLogoUrl !== undefined
          ? { logoUrl: resolvedLogoUrl }
          : {}),
      },
    });

    const updatedSettings = await tx.companySettings.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        ...DEFAULT_COMPANY_SETTINGS,
        currency,
        defaultVatRate,
        invoiceNoteTemplate: null,
      },
      update: {
        currency,
        defaultVatRate,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: "Firma bilgileri güncellendi.",
      },
    });

    return [updatedCompany, updatedSettings] as const;
  });

  return { company, settings };
}

async function validateAccountSelection(
  companyId: string,
  accountId: string | null | undefined
) {
  if (!accountId) return null;

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true, companyId: true },
  });

  const validation = validateAccountBelongsToCompany(account, companyId);

  if (!validation.ok) {
    throw new SettingsAccessError(validation.message, 400);
  }

  return accountId;
}

export async function updateInvoiceSettings(input: {
  companyId: string;
  userId: string;
  data: UpdateInvoiceSettingsInput;
}) {
  await assertCompanyAccess(input.userId, input.companyId);

  const settings = await db.$transaction(async (tx) => {
    const updated = await tx.companySettings.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        ...DEFAULT_COMPANY_SETTINGS,
        ...input.data,
        invoiceNoteTemplate:
          normalizeOptionalString(input.data.invoiceNoteTemplate) ?? null,
      },
      update: {
        ...input.data,
        invoiceNoteTemplate:
          normalizeOptionalString(input.data.invoiceNoteTemplate) ?? null,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: "Fatura ayarları güncellendi.",
      },
    });

    return updated;
  });

  return settings;
}

export async function updateCashBankSettings(input: {
  companyId: string;
  userId: string;
  data: UpdateCashBankSettingsInput;
}) {
  await assertCompanyAccess(input.userId, input.companyId);

  const defaultCollectionAccountId = await validateAccountSelection(
    input.companyId,
    input.data.defaultCollectionAccountId
  );
  const defaultExpenseAccountId = await validateAccountSelection(
    input.companyId,
    input.data.defaultExpenseAccountId
  );

  const settings = await db.$transaction(async (tx) => {
    const updated = await tx.companySettings.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        ...DEFAULT_COMPANY_SETTINGS,
        ...input.data,
        defaultCollectionAccountId,
        defaultExpenseAccountId,
      },
      update: {
        ...input.data,
        defaultCollectionAccountId,
        defaultExpenseAccountId,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: "Kasa ve banka ayarları güncellendi.",
      },
    });

    return updated;
  });

  return settings;
}

export async function updateNotificationSettings(input: {
  companyId: string;
  userId: string;
  data: UpdateNotificationSettingsInput;
}) {
  await assertCompanyAccess(input.userId, input.companyId);

  const settings = await db.$transaction(async (tx) => {
    const updated = await tx.companySettings.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        ...DEFAULT_COMPANY_SETTINGS,
        ...input.data,
      },
      update: input.data,
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "settings",
        message: "Bildirim ayarları güncellendi.",
      },
    });

    return updated;
  });

  return settings;
}
