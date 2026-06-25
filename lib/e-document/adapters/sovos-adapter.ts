import "server-only";

import { Prisma } from "@prisma/client";
import { assertIntegrationEncryptionConfigured } from "@/lib/marketplace/marketplace-crypto";
import { db } from "@/lib/prisma";
import type {
  EDocumentProviderAdapter,
  EDocumentTestResult,
  EDocumentUpsertInput,
} from "@/lib/e-document/adapters/e-document-adapter-types";
import {
  buildSovosCapabilitiesFromInput,
  parseSovosCapabilities,
} from "@/lib/e-document/sovos-capabilities";
import {
  decryptEDocumentCredentials,
  encryptEDocumentCredentials,
} from "@/lib/e-document/e-document-crypto";
import { runSovosConnectionTest } from "@/lib/e-document/providers/sovos/sovos-connection-service";

export type SovosStoredCredentials = {
  invoiceUsername: string;
  invoicePassword: string;
  archiveUsername: string;
  archivePassword: string;
  despatchUsername?: string;
  despatchPassword?: string;
  useSameArchiveCredentials: boolean;
};

const SOVOS_SETTINGS_SAVED_MESSAGE =
  "Sovos ayarları kaydedildi. Bağlantı testi için endpoint yapılandırması gerekir.";

export const sovosAdapter: EDocumentProviderAdapter = {
  provider: "SOVOS",

  async upsert(input: EDocumentUpsertInput) {
    if (input.provider !== "SOVOS") {
      throw new Error("Geçersiz sağlayıcı isteği.");
    }

    if (!input.taxId?.trim()) {
      throw new Error("Sovos için VKN/TCKN zorunludur.");
    }

    const existing = await db.efaturamIntegration.findUnique({
      where: { companyId: input.companyId },
    });

    let invoiceUsername = input.invoiceUsername?.trim() ?? "";
    let invoicePassword = input.invoicePassword ?? "";
    let archiveUsername = input.useSameArchiveCredentials
      ? invoiceUsername
      : (input.archiveUsername?.trim() ?? "");
    let archivePassword = input.useSameArchiveCredentials
      ? invoicePassword
      : (input.archivePassword ?? "");

    if (existing?.provider === "SOVOS" && existing.credentialsEncrypted) {
      const existingCredentials = decryptEDocumentCredentials<SovosStoredCredentials>(
        existing.credentialsEncrypted
      );
      if (!invoiceUsername) {
        invoiceUsername = existingCredentials?.invoiceUsername ?? "";
      }
      if (!invoicePassword) {
        invoicePassword = existingCredentials?.invoicePassword ?? "";
      }
      if (input.useSameArchiveCredentials) {
        archiveUsername = invoiceUsername;
        archivePassword = invoicePassword;
      } else {
        if (!archiveUsername) {
          archiveUsername = existingCredentials?.archiveUsername ?? "";
        }
        if (!archivePassword) {
          archivePassword = existingCredentials?.archivePassword ?? "";
        }
      }
    }

    if (!invoiceUsername || !invoicePassword) {
      throw new Error("E-Fatura web servis kullanıcı adı ve şifresi zorunludur.");
    }

    if (!input.useSameArchiveCredentials && (!archiveUsername || !archivePassword)) {
      throw new Error("E-Arşiv web servis kullanıcı adı ve şifresi zorunludur.");
    }

    if (input.useSameArchiveCredentials) {
      archiveUsername = invoiceUsername;
      archivePassword = invoicePassword;
    }

    assertIntegrationEncryptionConfigured();

    const credentials: SovosStoredCredentials = {
      invoiceUsername,
      invoicePassword,
      archiveUsername,
      archivePassword,
      useSameArchiveCredentials: input.useSameArchiveCredentials,
    };

    const capabilities = buildSovosCapabilitiesFromInput({
      hasInvoiceCredentials: Boolean(invoiceUsername && invoicePassword),
      hasArchiveCredentials: Boolean(archiveUsername && archivePassword),
    });

    return db.efaturamIntegration.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        provider: "SOVOS",
        status: "DISCONNECTED",
        connectionMode: null,
        environment: input.environment,
        externalCompanyCode: input.externalCompanyCode?.trim() || null,
        taxId: input.taxId.trim(),
        senderIdentifier: input.senderIdentifier?.trim() || null,
        receiverIdentifier: input.receiverIdentifier?.trim() || null,
        branchCode: input.branchCode?.trim() || null,
        invoiceSeries: input.invoiceSeries?.trim() || null,
        archiveSeries: input.archiveSeries?.trim() || null,
        capabilities,
        credentialsEncrypted: encryptEDocumentCredentials(credentials),
        prefix: null,
        xsltCode: null,
        providerCompanyId: null,
        providerUserId: null,
        partnerCustomerId: null,
        tokenExpiresAt: null,
        lastConnectedAt: null,
        lastTestedAt: null,
        lastSuccessfulAt: null,
        lastError: SOVOS_SETTINGS_SAVED_MESSAGE,
        lastErrorCode: "SOVOS_SETTINGS_SAVED",
        lastErrorMessage: SOVOS_SETTINGS_SAVED_MESSAGE,
      },
      update: {
        provider: "SOVOS",
        status: "DISCONNECTED",
        connectionMode: null,
        environment: input.environment,
        externalCompanyCode: input.externalCompanyCode?.trim() || null,
        taxId: input.taxId.trim(),
        senderIdentifier: input.senderIdentifier?.trim() || null,
        receiverIdentifier: input.receiverIdentifier?.trim() || null,
        branchCode: input.branchCode?.trim() || null,
        invoiceSeries: input.invoiceSeries?.trim() || null,
        archiveSeries: input.archiveSeries?.trim() || null,
        capabilities,
        credentialsEncrypted: encryptEDocumentCredentials(credentials),
        prefix: null,
        xsltCode: null,
        providerCompanyId: null,
        providerUserId: null,
        partnerCustomerId: null,
        tokenExpiresAt: null,
        lastConnectedAt: null,
        lastTestedAt: null,
        lastSuccessfulAt: null,
        lastError: SOVOS_SETTINGS_SAVED_MESSAGE,
        lastErrorCode: "SOVOS_SETTINGS_SAVED",
        lastErrorMessage: SOVOS_SETTINGS_SAVED_MESSAGE,
      },
    });
  },

  async test(companyId: string): Promise<EDocumentTestResult> {
    const integration = await db.efaturamIntegration.findUnique({
      where: { companyId },
    });

    if (!integration || integration.provider !== "SOVOS") {
      throw new Error("Sovos bağlantısı bulunamadı.");
    }

    const credentials = decryptEDocumentCredentials<SovosStoredCredentials>(
      integration.credentialsEncrypted
    );
    if (!credentials) {
      throw new Error("Sovos kimlik bilgileri eksik.");
    }

    if (!integration.taxId?.trim()) {
      throw new Error("Sovos VKN/TCKN bilgisi eksik.");
    }

    const environment = integration.environment ?? "STAGE";
    const result = await runSovosConnectionTest({
      environment,
      taxId: integration.taxId,
      senderIdentifier: integration.senderIdentifier,
      credentials,
    });

    const now = new Date();
    await db.efaturamIntegration.update({
      where: { companyId },
      data: {
        status: result.status,
        capabilities: result.capabilities,
        lastTestedAt: now,
        lastSuccessfulAt: result.ok ? now : integration.lastSuccessfulAt,
        lastConnectedAt: result.ok ? now : integration.lastConnectedAt,
        lastError: result.message,
        lastErrorCode: result.lastErrorCode,
        lastErrorMessage: result.lastErrorMessage,
      },
    });

    return {
      ok: result.ok,
      message: result.message,
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
        taxId: null,
        senderIdentifier: null,
        receiverIdentifier: null,
        branchCode: null,
        invoiceSeries: null,
        archiveSeries: null,
        capabilities: Prisma.JsonNull,
        lastError: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastTestedAt: null,
        lastSuccessfulAt: null,
      },
    });
  },
};

export function readSovosCredentialHints(
  credentialsEncrypted: string | null | undefined
) {
  const credentials = decryptEDocumentCredentials<SovosStoredCredentials>(
    credentialsEncrypted
  );
  if (!credentials) {
    return {
      hasCredentials: false,
      hasSavedInvoicePassword: false,
      hasSavedArchivePassword: false,
      invoiceUsername: null as string | null,
      archiveUsername: null as string | null,
      useSameArchiveCredentials: true,
    };
  }

  return {
    hasCredentials: true,
    hasSavedInvoicePassword: Boolean(credentials.invoicePassword),
    hasSavedArchivePassword: Boolean(credentials.archivePassword),
    invoiceUsername: credentials.invoiceUsername,
    archiveUsername: credentials.archiveUsername,
    useSameArchiveCredentials: credentials.useSameArchiveCredentials,
  };
}

export function readSovosCapabilitiesFromIntegration(capabilities: unknown) {
  return parseSovosCapabilities(capabilities);
}
