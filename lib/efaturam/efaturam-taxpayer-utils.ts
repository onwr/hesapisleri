import type { EfaturamTaxpayerAlias, EfaturamTaxpayerLookupResult } from "@/lib/efaturam/efaturam-types";

function isActiveInvoiceAlias(alias: EfaturamTaxpayerAlias) {
  if (alias.active === false) return false;
  const type = (alias.type ?? "").toUpperCase();
  return type.includes("INVOICE") || type === "PK" || type === "GB";
}

export function recommendDocumentTypeFromAliases(
  taxId: string,
  aliases: EfaturamTaxpayerAlias[]
): EfaturamTaxpayerLookupResult {
  const activeInvoiceAliases = aliases.filter(isActiveInvoiceAlias);

  return {
    taxId,
    aliases,
    activeInvoiceAliases,
    recommendedDocumentType:
      activeInvoiceAliases.length > 0 ? "E_INVOICE" : "E_ARCHIVE",
  };
}

export function normalizeTaxIdInput(value: string) {
  const taxId = value.replace(/\D/g, "");
  if (taxId.length !== 10 && taxId.length !== 11) {
    throw new Error("VKN/TCKN 10 veya 11 haneli olmalıdır.");
  }
  return taxId;
}

export function parseTaxpayerLookupResponse(
  taxId: string,
  body: unknown
): EfaturamTaxpayerLookupResult {
  const record = (body ?? {}) as Record<string, unknown>;
  const title =
    typeof record.title === "string"
      ? record.title
      : typeof record.name === "string"
        ? record.name
        : undefined;

  const rawAliases = Array.isArray(record.aliases)
    ? record.aliases
    : Array.isArray(record.aliasList)
      ? record.aliasList
      : [];

  const aliases: EfaturamTaxpayerAlias[] = [];
  for (const item of rawAliases) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const alias =
      typeof row.alias === "string"
        ? row.alias
        : typeof row.name === "string"
          ? row.name
          : null;
    if (!alias) continue;
    aliases.push({
      alias,
      type: typeof row.type === "string" ? row.type : undefined,
      title: typeof row.title === "string" ? row.title : undefined,
      active:
        typeof row.active === "boolean"
          ? row.active
          : typeof row.activated === "boolean"
            ? row.activated
            : undefined,
    });
  }

  return {
    ...recommendDocumentTypeFromAliases(taxId, aliases),
    title,
  };
}
