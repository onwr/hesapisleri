export type TaxIdKind = "VKN" | "TCKN";

export type TaxIdValidationResult =
  | { ok: true; taxId: string; kind: TaxIdKind }
  | { ok: false; message: string };

export function normalizeTaxId(value: string | null | undefined): TaxIdValidationResult {
  const taxId = String(value ?? "").replace(/\D/g, "");
  if (taxId.length === 10) {
    return { ok: true, taxId, kind: "VKN" };
  }
  if (taxId.length === 11) {
    return { ok: true, taxId, kind: "TCKN" };
  }
  if (!taxId) {
    return { ok: false, message: "VKN/TCKN zorunludur." };
  }
  return { ok: false, message: "VKN 10, TCKN 11 haneli olmalıdır." };
}

export function isCorporateTaxId(taxId: string) {
  return taxId.length === 10;
}
