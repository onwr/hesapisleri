import type { EfaturamConnectionMode, EfaturamEnvironment } from "@prisma/client";
import { efaturamRequest, EfaturamApiError } from "@/lib/efaturam/efaturam-client";
import {
  assertEfaturamPartnerConfigured,
  getEfaturamPartnerPassword,
} from "@/lib/efaturam/efaturam-config";
import {
  decryptEfaturamCredentials,
  encryptEfaturamCredentials,
  isEfaturamTokenExpired,
  resolveTokenExpiry,
} from "@/lib/efaturam/efaturam-crypto";
import { db } from "@/lib/prisma";
import type {
  EfaturamApplicationStatusResponse,
  EfaturamCustomerSignInResponse,
  EfaturamSignInResponse,
  EfaturamStoredCredentials,
} from "@/lib/efaturam/efaturam-types";

type IntegrationAuthContext = {
  integrationId: string;
  companyId: string;
  environment: EfaturamEnvironment;
  connectionMode: EfaturamConnectionMode | null;
  credentials: EfaturamStoredCredentials;
  providerCompanyId: string;
  providerUserId: string;
  partnerCustomerId?: string | null;
};

async function loadIntegrationAuthContext(
  companyId: string
): Promise<IntegrationAuthContext> {
  const integration = await db.efaturamIntegration.findUnique({
    where: { companyId },
  });

  if (!integration || integration.status !== "CONNECTED") {
    throw new Error("Trendyol E-Faturam bağlantısı aktif değil.");
  }

  if (integration.provider !== "TRENDYOL_EFATURAM") {
    throw new Error("Bu işlem yalnızca Trendyol E-Faturam sağlayıcısı ile kullanılabilir.");
  }

  if (integration.provider !== "TRENDYOL_EFATURAM") {
    throw new Error("Mükellef sorgusu yalnızca Trendyol E-Faturam ile kullanılabilir.");
  }

  if (!integration.providerCompanyId || !integration.providerUserId) {
    throw new Error("E-Faturam sağlayıcı kimlik bilgileri eksik.");
  }

  const credentials = decryptEfaturamCredentials(integration.credentialsEncrypted);
  if (!credentials?.accessToken) {
    throw new Error("E-Faturam erişim tokenı bulunamadı.");
  }

  return {
    integrationId: integration.id,
    companyId,
    environment: integration.environment,
    connectionMode: integration.connectionMode,
    credentials,
    providerCompanyId: integration.providerCompanyId,
    providerUserId: integration.providerUserId,
    partnerCustomerId: integration.partnerCustomerId,
  };
}

async function persistAuthTokens(
  integrationId: string,
  current: EfaturamStoredCredentials,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
    userId?: string;
    companyId?: string;
    partnerCustomerId?: string;
  }
) {
  const nextCredentials: EfaturamStoredCredentials = {
    ...current,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? current.refreshToken,
  };

  await db.efaturamIntegration.update({
    where: { id: integrationId },
    data: {
      credentialsEncrypted: encryptEfaturamCredentials(nextCredentials),
      tokenExpiresAt: tokens.expiresAt,
      providerUserId: tokens.userId ?? undefined,
      providerCompanyId: tokens.companyId ?? undefined,
      partnerCustomerId: tokens.partnerCustomerId ?? undefined,
      lastConnectedAt: new Date(),
      lastError: null,
      status: "CONNECTED",
    },
  });
}

async function partnerSignIn(environment: EfaturamEnvironment) {
  const partner = assertEfaturamPartnerConfigured();
  const response = await efaturamRequest<EfaturamSignInResponse>({
    environment,
    path: "/signIn",
    method: "POST",
    body: {
      username: partner.username,
      password: getEfaturamPartnerPassword(),
    },
  });

  if (!response.accessToken) {
    throw new Error("Partner oturumu açılamadı.");
  }

  return response;
}

async function refreshAccessToken(
  environment: EfaturamEnvironment,
  refreshToken: string
) {
  try {
    return await efaturamRequest<EfaturamSignInResponse>({
      environment,
      path: "/refreshToken",
      method: "POST",
      body: { refreshToken },
    });
  } catch {
    return null;
  }
}

async function directCustomerSignIn(input: {
  environment: EfaturamEnvironment;
  email: string;
  password: string;
  taxId: string;
}) {
  const response = await efaturamRequest<EfaturamCustomerSignInResponse>({
    environment: input.environment,
    path: "/customerSignIn",
    method: "POST",
    body: {
      email: input.email,
      password: input.password,
      taxId: input.taxId,
    },
  });

  if (!response.accessToken) {
    throw new Error("E-Faturam hesabına giriş yapılamadı.");
  }

  return response;
}

async function partnerCustomerSignIn(input: {
  environment: EfaturamEnvironment;
  partnerAccessToken: string;
  customerId: string;
}) {
  const response = await efaturamRequest<EfaturamCustomerSignInResponse>({
    environment: input.environment,
    path: "/customerSignIn",
    method: "POST",
    accessToken: input.partnerAccessToken,
    body: { customerId: input.customerId },
  });

  if (!response.accessToken) {
    throw new Error("Alt mükellef oturumu açılamadı.");
  }

  return response;
}

export async function getPartnerApplicationStatus(input: {
  environment: EfaturamEnvironment;
  partnerId: string;
  partnerAccessToken: string;
  taxId: string;
}) {
  return efaturamRequest<EfaturamApplicationStatusResponse>({
    environment: input.environment,
    path: `/api/invoice/partners/${input.partnerId}/application-status/by-tax-id/${input.taxId}`,
    accessToken: input.partnerAccessToken,
  });
}

export async function connectEfaturamDirectAccount(input: {
  companyId: string;
  environment: EfaturamEnvironment;
  email: string;
  password: string;
  taxId: string;
  prefix?: string | null;
  xsltCode?: string | null;
}) {
  const signIn = await directCustomerSignIn({
    environment: input.environment,
    email: input.email,
    password: input.password,
    taxId: input.taxId,
  });

  const expiresAt = resolveTokenExpiry(signIn.expiresIn);
  const credentials: EfaturamStoredCredentials = {
    accessToken: signIn.accessToken,
    refreshToken: signIn.refreshToken,
    expiresAt: expiresAt.toISOString(),
    email: input.email,
    password: input.password,
  };

  return db.efaturamIntegration.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      provider: "TRENDYOL_EFATURAM",
      connectionMode: "DIRECT_ACCOUNT",
      environment: input.environment,
      status: "CONNECTED",
      prefix: input.prefix ?? null,
      xsltCode: input.xsltCode ?? null,
      providerCompanyId: String(signIn.companyId),
      providerUserId: String(signIn.userId),
      partnerCustomerId: signIn.partnerCustomerId
        ? String(signIn.partnerCustomerId)
        : null,
      credentialsEncrypted: encryptEfaturamCredentials(credentials),
      tokenExpiresAt: expiresAt,
      lastConnectedAt: new Date(),
      lastError: null,
    },
    update: {
      provider: "TRENDYOL_EFATURAM",
      connectionMode: "DIRECT_ACCOUNT",
      environment: input.environment,
      status: "CONNECTED",
      prefix: input.prefix ?? null,
      xsltCode: input.xsltCode ?? null,
      externalCompanyCode: null,
      providerCompanyId: String(signIn.companyId),
      providerUserId: String(signIn.userId),
      partnerCustomerId: signIn.partnerCustomerId
        ? String(signIn.partnerCustomerId)
        : null,
      credentialsEncrypted: encryptEfaturamCredentials(credentials),
      tokenExpiresAt: expiresAt,
      lastConnectedAt: new Date(),
      lastError: null,
    },
  });
}

export async function connectEfaturamPartnerAccount(input: {
  companyId: string;
  environment: EfaturamEnvironment;
  taxId: string;
  prefix?: string | null;
  xsltCode?: string | null;
}) {
  const partner = assertEfaturamPartnerConfigured();
  const partnerSignInResponse = await partnerSignIn(input.environment);
  const application = await getPartnerApplicationStatus({
    environment: input.environment,
    partnerId: partner.partnerId!,
    partnerAccessToken: partnerSignInResponse.accessToken,
    taxId: input.taxId,
  });

  if (!application.partnerCustomerId) {
    throw new Error("Partner mükellef kaydı bulunamadı.");
  }

  const customerSignIn = await partnerCustomerSignIn({
    environment: input.environment,
    partnerAccessToken: partnerSignInResponse.accessToken,
    customerId: String(application.partnerCustomerId),
  });

  const expiresAt = resolveTokenExpiry(customerSignIn.expiresIn);
  const credentials: EfaturamStoredCredentials = {
    accessToken: customerSignIn.accessToken,
    refreshToken: customerSignIn.refreshToken,
    expiresAt: expiresAt.toISOString(),
  };

  return db.efaturamIntegration.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      provider: "TRENDYOL_EFATURAM",
      connectionMode: "MARKETPLACE_PARTNER",
      environment: input.environment,
      status: "CONNECTED",
      prefix: input.prefix ?? null,
      xsltCode: input.xsltCode ?? null,
      providerCompanyId: String(customerSignIn.companyId),
      providerUserId: String(customerSignIn.userId),
      partnerCustomerId: String(application.partnerCustomerId),
      credentialsEncrypted: encryptEfaturamCredentials(credentials),
      tokenExpiresAt: expiresAt,
      lastConnectedAt: new Date(),
      lastError: null,
    },
    update: {
      provider: "TRENDYOL_EFATURAM",
      connectionMode: "MARKETPLACE_PARTNER",
      environment: input.environment,
      status: "CONNECTED",
      prefix: input.prefix ?? null,
      xsltCode: input.xsltCode ?? null,
      externalCompanyCode: null,
      providerCompanyId: String(customerSignIn.companyId),
      providerUserId: String(customerSignIn.userId),
      partnerCustomerId: String(application.partnerCustomerId),
      credentialsEncrypted: encryptEfaturamCredentials(credentials),
      tokenExpiresAt: expiresAt,
      lastConnectedAt: new Date(),
      lastError: null,
    },
  });
}

async function ensureFreshAccessToken(context: IntegrationAuthContext) {
  const integration = await db.efaturamIntegration.findUnique({
    where: { id: context.integrationId },
    select: { tokenExpiresAt: true },
  });

  if (!isEfaturamTokenExpired(integration?.tokenExpiresAt)) {
    return context.credentials.accessToken;
  }

  if (context.credentials.refreshToken) {
    const refreshed = await refreshAccessToken(
      context.environment,
      context.credentials.refreshToken
    );
    if (refreshed?.accessToken) {
      const expiresAt = resolveTokenExpiry(refreshed.expiresIn);
      await persistAuthTokens(context.integrationId, context.credentials, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt,
      });
      return refreshed.accessToken;
    }
  }

  if (context.connectionMode === "DIRECT_ACCOUNT") {
    if (!context.credentials.email || !context.credentials.password) {
      throw new Error("E-Faturam hesap bilgileri yeniden giriş için eksik.");
    }

    const company = await db.company.findUnique({
      where: { id: context.companyId },
      select: { taxNo: true },
    });
    if (!company?.taxNo) {
      throw new Error("Firma vergi numarası tanımlı değil.");
    }

    const signIn = await directCustomerSignIn({
      environment: context.environment,
      email: context.credentials.email,
      password: context.credentials.password,
      taxId: company.taxNo.replace(/\D/g, ""),
    });

    const expiresAt = resolveTokenExpiry(signIn.expiresIn);
    await persistAuthTokens(context.integrationId, context.credentials, {
      accessToken: signIn.accessToken,
      refreshToken: signIn.refreshToken,
      expiresAt,
      userId: String(signIn.userId),
      companyId: String(signIn.companyId),
      partnerCustomerId: signIn.partnerCustomerId
        ? String(signIn.partnerCustomerId)
        : undefined,
    });
    return signIn.accessToken;
  }

  const company = await db.company.findUnique({
    where: { id: context.companyId },
    select: { taxNo: true },
  });
  if (!company?.taxNo) {
    throw new Error("Firma vergi numarası tanımlı değil.");
  }

  await connectEfaturamPartnerAccount({
    companyId: context.companyId,
    environment: context.environment,
    taxId: company.taxNo.replace(/\D/g, ""),
  });

  const refreshedContext = await loadIntegrationAuthContext(context.companyId);
  return refreshedContext.credentials.accessToken;
}

export async function withEfaturamAccessToken<T>(
  companyId: string,
  handler: (accessToken: string, context: IntegrationAuthContext) => Promise<T>
) {
  const context = await loadIntegrationAuthContext(companyId);
  const accessToken = await ensureFreshAccessToken(context);

  try {
    return await handler(accessToken, context);
  } catch (error) {
    if (error instanceof EfaturamApiError && error.status === 401) {
      const renewed = await ensureFreshAccessToken({
        ...context,
        credentials: {
          ...context.credentials,
          accessToken,
        },
      });
      return handler(renewed, context);
    }
    throw error;
  }
}

export async function lookupTaxpayer(input: {
  companyId: string;
  taxId: string;
}) {
  return withEfaturamAccessToken(input.companyId, async (accessToken, context) => {
    return efaturamRequest<unknown>({
      environment: context.environment,
      path: `/api/invoice/taxpayers/${input.taxId}`,
      accessToken,
    });
  });
}
