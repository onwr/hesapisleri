import "server-only";

import type { EfaturamIntegration } from "@prisma/client";
import {
  connectEfaturamDirectAccount,
  connectEfaturamPartnerAccount,
} from "@/lib/efaturam/efaturam-auth-service";
import { getEfaturamPartnerConfig } from "@/lib/efaturam/efaturam-config";
import { decryptEfaturamCredentials } from "@/lib/efaturam/efaturam-crypto";
import { db } from "@/lib/prisma";
import type {
  EDocumentProviderAdapter,
  EDocumentTestResult,
  EDocumentUpsertInput,
} from "@/lib/e-document/adapters/e-document-adapter-types";

async function getCompanyTaxId(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { taxNo: true },
  });
  if (!company?.taxNo) {
    throw new Error("Firma vergi numarası tanımlı değil.");
  }
  return company.taxNo.replace(/\D/g, "");
}

export const trendyolEfaturamAdapter: EDocumentProviderAdapter = {
  provider: "TRENDYOL_EFATURAM",

  async upsert(input: EDocumentUpsertInput) {
    if (input.provider !== "TRENDYOL_EFATURAM") {
      throw new Error("Geçersiz sağlayıcı isteği.");
    }

    const taxId = await getCompanyTaxId(input.companyId);

    if (input.connectionMode === "DIRECT_ACCOUNT") {
      const existing = await db.efaturamIntegration.findUnique({
        where: { companyId: input.companyId },
      });

      let email = input.email?.trim() ?? "";
      let password = input.password ?? "";

      if (
        !password &&
        existing?.provider === "TRENDYOL_EFATURAM" &&
        existing.credentialsEncrypted
      ) {
        const existingCredentials = decryptEfaturamCredentials(
          existing.credentialsEncrypted
        );
        password = existingCredentials?.password ?? "";
        if (!email) {
          email = existingCredentials?.email ?? "";
        }
      }

      if (!email || !password.trim()) {
        throw new Error("E-Faturam e-posta ve şifre zorunludur.");
      }

      return connectEfaturamDirectAccount({
        companyId: input.companyId,
        environment: input.environment,
        email,
        password,
        taxId,
        prefix: input.prefix,
        xsltCode: input.xsltCode,
      });
    }

    const partner = getEfaturamPartnerConfig();
    if (!partner.enabled) {
      throw new Error("Partner entegrasyon modu şu an kullanılamıyor.");
    }

    return connectEfaturamPartnerAccount({
      companyId: input.companyId,
      environment: input.environment,
      taxId,
      prefix: input.prefix,
      xsltCode: input.xsltCode,
    });
  },

  async test(companyId: string): Promise<EDocumentTestResult> {
    const integration = await db.efaturamIntegration.findUnique({
      where: { companyId },
    });

    if (!integration || integration.provider !== "TRENDYOL_EFATURAM") {
      throw new Error("Trendyol E-Faturam bağlantısı bulunamadı.");
    }

    if (integration.status !== "CONNECTED") {
      throw new Error("Aktif Trendyol E-Faturam bağlantısı yok.");
    }

    const credentials = decryptEfaturamCredentials(integration.credentialsEncrypted);
    if (!credentials?.accessToken) {
      throw new Error("E-Faturam oturum bilgisi eksik.");
    }

    return {
      ok: true,
      message: "Trendyol E-Faturam bağlantısı doğrulandı.",
      tokenExpiresAt: integration.tokenExpiresAt?.toISOString() ?? null,
    };
  },

  async disconnect(companyId: string) {
    const existing = await db.efaturamIntegration.findUnique({
      where: { companyId },
    });
    if (!existing) return null;

    return db.efaturamIntegration.update({
      where: { companyId },
      data: {
        status: "DISCONNECTED",
        credentialsEncrypted: null,
        tokenExpiresAt: null,
        providerCompanyId: null,
        providerUserId: null,
        partnerCustomerId: null,
        externalCompanyCode: null,
        lastError: null,
      },
    });
  },
};
