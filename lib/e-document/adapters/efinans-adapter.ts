import "server-only";

import { assertIntegrationEncryptionConfigured } from "@/lib/marketplace/marketplace-crypto";
import { db } from "@/lib/prisma";
import type {
  EDocumentProviderAdapter,
  EDocumentTestResult,
  EDocumentUpsertInput,
} from "@/lib/e-document/adapters/e-document-adapter-types";
import {
  decryptEDocumentCredentials,
  encryptEDocumentCredentials,
} from "@/lib/e-document/e-document-crypto";

type EfinansStoredCredentials = {
  username: string;
  password: string;
  companyCode: string;
};

export const efinansAdapter: EDocumentProviderAdapter = {
  provider: "EFINANS",

  async upsert(input: EDocumentUpsertInput) {
    if (input.provider !== "EFINANS") {
      throw new Error("Geçersiz sağlayıcı isteği.");
    }

    if (!input.username?.trim() && !input.companyCode.trim()) {
      throw new Error("eFinans kullanıcı adı ve firma kodu zorunludur.");
    }

    const existing = await db.efaturamIntegration.findUnique({
      where: { companyId: input.companyId },
    });

    let username = input.username?.trim() ?? "";
    if (!username && existing?.provider === "EFINANS" && existing.credentialsEncrypted) {
      const existingCredentials = decryptEDocumentCredentials<EfinansStoredCredentials>(
        existing.credentialsEncrypted
      );
      username = existingCredentials?.username ?? "";
    }

    if (!username || !input.companyCode.trim()) {
      throw new Error("eFinans kullanıcı adı ve firma kodu zorunludur.");
    }

    let password = input.password?.trim() ?? "";
    if (!password && existing?.provider === "EFINANS" && existing.credentialsEncrypted) {
      const existingCredentials = decryptEDocumentCredentials<EfinansStoredCredentials>(
        existing.credentialsEncrypted
      );
      password = existingCredentials?.password ?? "";
    }

    if (!password) {
      throw new Error("eFinans şifresi zorunludur.");
    }

    assertIntegrationEncryptionConfigured();

    const credentials: EfinansStoredCredentials = {
      username,
      password,
      companyCode: input.companyCode.trim(),
    };

    return db.efaturamIntegration.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        provider: "EFINANS",
        status: "DISCONNECTED",
        connectionMode: null,
        environment: input.environment,
        externalCompanyCode: credentials.companyCode,
        credentialsEncrypted: encryptEDocumentCredentials(credentials),
        lastError: "eFinans API entegrasyonu henüz hazır değil.",
      },
      update: {
        provider: "EFINANS",
        status: "DISCONNECTED",
        connectionMode: null,
        environment: input.environment,
        prefix: null,
        xsltCode: null,
        externalCompanyCode: credentials.companyCode,
        providerCompanyId: null,
        providerUserId: null,
        partnerCustomerId: null,
        tokenExpiresAt: null,
        credentialsEncrypted: encryptEDocumentCredentials(credentials),
        lastConnectedAt: null,
        lastError: "eFinans API entegrasyonu henüz hazır değil.",
      },
    });
  },

  async test(): Promise<EDocumentTestResult> {
    return {
      ok: false,
      message: "eFinans API entegrasyonu henüz hazır değil. Ayarlar kaydedildi.",
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
        externalCompanyCode: null,
        lastError: null,
      },
    });
  },
};

export function readEfinansCredentialHints(
  credentialsEncrypted: string | null | undefined
) {
  const credentials = decryptEDocumentCredentials<EfinansStoredCredentials>(
    credentialsEncrypted
  );
  if (!credentials) {
    return {
      hasCredentials: false,
      hasSavedPassword: false,
      username: null as string | null,
      companyCode: null as string | null,
    };
  }

  return {
    hasCredentials: true,
    hasSavedPassword: Boolean(credentials.password),
    username: credentials.username,
    companyCode: credentials.companyCode,
  };
}
