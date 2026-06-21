import type { EDocumentUpsertInput } from "@/lib/e-document/adapters/e-document-adapter-types";

export function assertEDocumentProviderPayloadIsolation(input: EDocumentUpsertInput) {
  if (input.provider === "TRENDYOL_EFATURAM") {
    const stray = input as EDocumentUpsertInput & {
      username?: string;
      companyCode?: string;
    };
    if (stray.username || stray.companyCode) {
      throw new Error("eFinans bilgileri Trendyol bağlantısına gönderilemez.");
    }
    return;
  }

  if (input.provider === "EFINANS") {
    const stray = input as EDocumentUpsertInput & {
      email?: string;
      connectionMode?: string;
      prefix?: string | null;
      xsltCode?: string | null;
    };
    if (
      stray.email ||
      stray.connectionMode ||
      stray.prefix ||
      stray.xsltCode
    ) {
      throw new Error("Trendyol bilgileri eFinans ayarlarına gönderilemez.");
    }
  }
}

const SENSITIVE_FIELDS = new Set(["password", "email", "username", "companyCode"]);

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
