import type { EDocumentUpsertInput } from "@/lib/e-document/adapters/e-document-adapter-types";

const TRENDYOL_STRAY_KEYS = [
  "username",
  "companyCode",
  "taxId",
  "invoiceUsername",
  "invoicePassword",
  "archiveUsername",
  "archivePassword",
  "useSameArchiveCredentials",
  "senderIdentifier",
  "receiverIdentifier",
  "branchCode",
  "invoiceSeries",
  "archiveSeries",
  "externalCompanyCode",
] as const;

const EFINANS_STRAY_KEYS = [
  "email",
  "connectionMode",
  "prefix",
  "xsltCode",
  "taxId",
  "invoiceUsername",
  "invoicePassword",
  "archiveUsername",
  "archivePassword",
  "useSameArchiveCredentials",
  "senderIdentifier",
  "receiverIdentifier",
  "branchCode",
  "invoiceSeries",
  "archiveSeries",
] as const;

const SOVOS_STRAY_KEYS = [
  "email",
  "connectionMode",
  "prefix",
  "xsltCode",
  "username",
  "companyCode",
] as const;

function hasStrayFields(
  input: Record<string, unknown>,
  keys: readonly string[]
) {
  return keys.some((key) => {
    const value = input[key];
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && !value.trim()) return false;
    if (typeof value === "boolean" && key === "useSameArchiveCredentials") {
      return false;
    }
    return true;
  });
}

export function assertEDocumentProviderPayloadIsolation(input: EDocumentUpsertInput) {
  const raw = input as EDocumentUpsertInput & Record<string, unknown>;

  if (input.provider === "TRENDYOL_EFATURAM") {
    if (hasStrayFields(raw, TRENDYOL_STRAY_KEYS)) {
      throw new Error("Sovos veya eFinans bilgileri Trendyol bağlantısına gönderilemez.");
    }
    return;
  }

  if (input.provider === "EFINANS") {
    if (hasStrayFields(raw, EFINANS_STRAY_KEYS)) {
      throw new Error("Trendyol veya Sovos bilgileri eFinans ayarlarına gönderilemez.");
    }
    return;
  }

  if (input.provider === "SOVOS") {
    if (hasStrayFields(raw, SOVOS_STRAY_KEYS)) {
      throw new Error("Trendyol veya eFinans bilgileri Sovos ayarlarına gönderilemez.");
    }
  }
}

const SENSITIVE_FIELDS = new Set([
  "password",
  "email",
  "username",
  "companyCode",
  "invoicePassword",
  "archivePassword",
  "invoiceUsername",
  "archiveUsername",
  "despatchPassword",
  "despatchUsername",
]);

export function redactEDocumentValidationErrors(
  errors: {
    formErrors: string[];
    fieldErrors: Record<string, string[] | undefined>;
  }
) {
  return {
    formErrors: errors.formErrors,
    fieldErrors: Object.fromEntries(
      Object.entries(errors.fieldErrors).map(([key, value]) => [
        key,
        SENSITIVE_FIELDS.has(key) ? ["Geçersiz değer."] : value,
      ])
    ),
  };
}
