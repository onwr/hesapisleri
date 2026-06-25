import "server-only";

import type { EfaturamEnvironment, EfaturamIntegrationStatus } from "@prisma/client";
import { testSovosArchiveConnection } from "@/lib/e-document/providers/sovos/sovos-archive-client";
import { testSovosDespatchConnection } from "@/lib/e-document/providers/sovos/sovos-despatch-client";
import { testSovosInvoiceConnection } from "@/lib/e-document/providers/sovos/sovos-invoice-client";
import {
  SovosError,
  userMessageForSovosError,
} from "@/lib/e-document/providers/sovos/sovos-errors";
import {
  resolveSovosServiceEndpoint,
} from "@/lib/e-document/providers/sovos/sovos-config";
import type { SovosCapabilities, SovosVerificationMode } from "@/lib/e-document/sovos-capabilities";
import { buildSovosCapabilitiesFromTestOutcomes } from "@/lib/e-document/sovos-capabilities";

export type SovosConnectionCredentials = {
  invoiceUsername: string;
  invoicePassword: string;
  archiveUsername: string;
  archivePassword: string;
  despatchUsername?: string;
  despatchPassword?: string;
  useSameArchiveCredentials: boolean;
};

export type SovosServiceTestOutcome = {
  service: "eInvoice" | "eArchive" | "eDespatch";
  ok: boolean;
  skipped: boolean;
  errorCode?: string;
  message?: string;
};

export type SovosConnectionTestResult = {
  ok: boolean;
  status: EfaturamIntegrationStatus;
  capabilities: SovosCapabilities;
  outcomes: SovosServiceTestOutcome[];
  message: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

function hasRealCredentials(username?: string, password?: string) {
  return Boolean(username?.trim() && password);
}

function canRunRealTest() {
  return process.env.SOVOS_ALLOW_REAL_CONNECTION_TEST === "true";
}

function endpointConfigured(
  service: "invoice" | "archive" | "despatch",
  environment: EfaturamEnvironment
) {
  return Boolean(resolveSovosServiceEndpoint(service, environment));
}

export function buildVerifiedSovosCapabilities(input: {
  credentials: SovosConnectionCredentials;
  outcomes: SovosServiceTestOutcome[];
  verificationMode: SovosVerificationMode;
}): SovosCapabilities {
  return buildSovosCapabilitiesFromTestOutcomes({
    credentials: {
      hasInvoiceCredentials: hasRealCredentials(
        input.credentials.invoiceUsername,
        input.credentials.invoicePassword
      ),
      hasArchiveCredentials: hasRealCredentials(
        input.credentials.archiveUsername,
        input.credentials.archivePassword
      ),
      hasDespatchCredentials: hasRealCredentials(
        input.credentials.despatchUsername,
        input.credentials.despatchPassword
      ),
    },
    outcomes: input.outcomes,
    verificationMode: input.verificationMode,
  });
}

function resolveIntegrationStatus(
  outcomes: SovosServiceTestOutcome[],
  verificationMode: SovosVerificationMode
): EfaturamIntegrationStatus {
  if (verificationMode !== "real") {
    const required = outcomes.filter((item) => !item.skipped);
    if (required.length === 0) return "DISCONNECTED";
    const successCount = required.filter((item) => item.ok).length;
    return successCount > 0 ? "ERROR" : "ERROR";
  }

  const required = outcomes.filter((item) => !item.skipped);
  if (required.length === 0) return "DISCONNECTED";

  const successCount = required.filter((item) => item.ok).length;
  if (successCount === required.length) return "CONNECTED";
  if (successCount > 0) return "PARTIALLY_CONNECTED";
  return "ERROR";
}

function resolveVerificationMode(input: {
  fetchImpl?: typeof fetch;
  realTestAllowed: boolean;
}): SovosVerificationMode {
  if (!input.realTestAllowed) return "none";
  if (input.fetchImpl) return "mock";
  return "real";
}

function buildCapabilitiesPayload(
  credentials: SovosConnectionCredentials,
  outcomes: SovosServiceTestOutcome[],
  verificationMode: SovosVerificationMode
) {
  return buildVerifiedSovosCapabilities({ credentials, outcomes, verificationMode });
}

export async function runSovosConnectionTest(input: {
  environment: EfaturamEnvironment;
  taxId: string;
  senderIdentifier?: string | null;
  credentials: SovosConnectionCredentials;
  invoiceEndpointOverride?: string | null;
  archiveEndpointOverride?: string | null;
  despatchEndpointOverride?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<SovosConnectionTestResult> {
  const outcomes: SovosServiceTestOutcome[] = [];
  const realTestAllowed = canRunRealTest();
  const verificationMode = resolveVerificationMode({
    fetchImpl: input.fetchImpl,
    realTestAllowed,
  });

  const invoiceConfigured = hasRealCredentials(
    input.credentials.invoiceUsername,
    input.credentials.invoicePassword
  );
  const archiveConfigured = hasRealCredentials(
    input.credentials.archiveUsername,
    input.credentials.archivePassword
  );
  const despatchConfigured = hasRealCredentials(
    input.credentials.despatchUsername,
    input.credentials.despatchPassword
  );

  if (!invoiceConfigured && !archiveConfigured) {
    return {
      ok: false,
      status: "DISCONNECTED",
      capabilities: buildCapabilitiesPayload(input.credentials, outcomes, verificationMode),
      outcomes,
      message: "Sovos web servis kimlik bilgileri eksik.",
      lastErrorCode: "MISSING_CREDENTIALS",
      lastErrorMessage: "Sovos web servis kimlik bilgileri eksik.",
    };
  }

  if (!realTestAllowed) {
    return {
      ok: false,
      status: "DISCONNECTED",
      capabilities: buildCapabilitiesPayload(input.credentials, outcomes, verificationMode),
      outcomes,
      message:
        "Gerçek Sovos bağlantı testi devre dışı. SOVOS_ALLOW_REAL_CONNECTION_TEST=true ve endpoint env değişkenleri gerekir.",
      lastErrorCode: "SOVOS_REAL_TEST_DISABLED",
      lastErrorMessage:
        "Gerçek bağlantı testi yapılandırılmadı; başarılı sayılmaz.",
    };
  }

  if (invoiceConfigured) {
    if (
      !input.invoiceEndpointOverride &&
      !endpointConfigured("invoice", input.environment)
    ) {
      outcomes.push({
        service: "eInvoice",
        ok: false,
        skipped: false,
        errorCode: "ENDPOINT_NOT_CONFIGURED",
        message: "E-Fatura endpoint yapılandırılmamış.",
      });
    } else {
      try {
        await testSovosInvoiceConnection({
          environment: input.environment,
          credentials: {
            username: input.credentials.invoiceUsername,
            password: input.credentials.invoicePassword,
          },
          taxId: input.taxId,
          senderIdentifier: input.senderIdentifier,
          endpointOverride: input.invoiceEndpointOverride,
          fetchImpl: input.fetchImpl,
          timeoutMs: input.timeoutMs,
        });
        outcomes.push({ service: "eInvoice", ok: true, skipped: false });
      } catch (error) {
        const sovosError =
          error instanceof SovosError
            ? error
            : new SovosError("UNKNOWN", error instanceof Error ? error.message : String(error));
        outcomes.push({
          service: "eInvoice",
          ok: false,
          skipped: false,
          errorCode: sovosError.code,
          message: userMessageForSovosError(sovosError),
        });
      }
    }
  } else {
    outcomes.push({ service: "eInvoice", ok: false, skipped: true });
  }

  if (archiveConfigured) {
    if (
      !input.archiveEndpointOverride &&
      !endpointConfigured("archive", input.environment)
    ) {
      outcomes.push({
        service: "eArchive",
        ok: false,
        skipped: false,
        errorCode: "ENDPOINT_NOT_CONFIGURED",
        message: "E-Arşiv endpoint yapılandırılmamış.",
      });
    } else {
      try {
        await testSovosArchiveConnection({
          environment: input.environment,
          credentials: {
            username: input.credentials.archiveUsername,
            password: input.credentials.archivePassword,
          },
          taxId: input.taxId,
          endpointOverride: input.archiveEndpointOverride,
          fetchImpl: input.fetchImpl,
          timeoutMs: input.timeoutMs,
        });
        outcomes.push({ service: "eArchive", ok: true, skipped: false });
      } catch (error) {
        const sovosError =
          error instanceof SovosError
            ? error
            : new SovosError("UNKNOWN", error instanceof Error ? error.message : String(error));
        outcomes.push({
          service: "eArchive",
          ok: false,
          skipped: false,
          errorCode: sovosError.code,
          message: userMessageForSovosError(sovosError),
        });
      }
    }
  } else {
    outcomes.push({ service: "eArchive", ok: false, skipped: true });
  }

  if (despatchConfigured) {
    if (
      !input.despatchEndpointOverride &&
      !endpointConfigured("despatch", input.environment)
    ) {
      outcomes.push({
        service: "eDespatch",
        ok: false,
        skipped: false,
        errorCode: "ENDPOINT_NOT_CONFIGURED",
        message: "E-İrsaliye endpoint yapılandırılmamış.",
      });
    } else {
      try {
        await testSovosDespatchConnection({
          environment: input.environment,
          credentials: {
            username: input.credentials.despatchUsername!,
            password: input.credentials.despatchPassword!,
          },
          taxId: input.taxId,
          senderIdentifier: input.senderIdentifier,
          endpointOverride: input.despatchEndpointOverride,
          fetchImpl: input.fetchImpl,
          timeoutMs: input.timeoutMs,
        });
        outcomes.push({ service: "eDespatch", ok: true, skipped: false });
      } catch (error) {
        const sovosError =
          error instanceof SovosError
            ? error
            : new SovosError("UNKNOWN", error instanceof Error ? error.message : String(error));
        outcomes.push({
          service: "eDespatch",
          ok: false,
          skipped: false,
          errorCode: sovosError.code,
          message: userMessageForSovosError(sovosError),
        });
      }
    }
  } else {
    outcomes.push({ service: "eDespatch", ok: false, skipped: true });
  }

  const capabilities = buildCapabilitiesPayload(input.credentials, outcomes, verificationMode);
  const status = resolveIntegrationStatus(outcomes, verificationMode);
  const requiredOutcomes = outcomes.filter((item) => !item.skipped);
  const ok = verificationMode === "real" && status === "CONNECTED";

  const firstFailure = requiredOutcomes.find((item) => !item.ok);
  const message = ok
    ? "Sovos bağlantı testi başarılı."
    : status === "PARTIALLY_CONNECTED"
      ? "Sovos bağlantısı kısmen doğrulandı; bazı servisler başarısız."
      : firstFailure?.message ?? "Sovos bağlantı testi başarısız.";

  return {
    ok,
    status,
    capabilities,
    outcomes,
    message,
    lastErrorCode: ok ? null : firstFailure?.errorCode ?? "SOVOS_CONNECTION_FAILED",
    lastErrorMessage: ok ? null : message,
  };
}
