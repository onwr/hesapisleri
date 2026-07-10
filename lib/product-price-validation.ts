import { z } from "zod";
import { parseTurkishMoneyInput } from "@/lib/money-input-utils";

export const PRODUCT_PRICE_NEGATIVE_ERROR = "Fiyat 0'dan küçük olamaz.";

export type ProductPriceFieldKey =
  | "buyPrice"
  | "sellPrice"
  | "purchasePrice"
  | "wholesalePrice"
  | "campaignPrice"
  | "costPrice"
  | "salePrice";

export type ProductPriceParseResult =
  | { ok: true; value: number }
  | { ok: false; message: string; field?: ProductPriceFieldKey };

export function validateProductPriceValue(
  value: number
): ProductPriceParseResult {
  if (!Number.isFinite(value)) {
    return { ok: false, message: PRODUCT_PRICE_NEGATIVE_ERROR };
  }

  if (value < 0) {
    return { ok: false, message: PRODUCT_PRICE_NEGATIVE_ERROR };
  }

  return { ok: true, value };
}

export function parseProductPriceInput(
  value: string,
  options?: { allowEmpty?: boolean; field?: ProductPriceFieldKey }
): ProductPriceParseResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: 0 };
  }

  const parsed = parseTurkishMoneyInput(trimmed);
  const validated = validateProductPriceValue(parsed);

  if (!validated.ok) {
    return { ...validated, field: options?.field };
  }

  return validated;
}

export const canonicalProductPriceSchema = z
  .number()
  .refine((value) => Number.isFinite(value) && value >= 0, {
    message: PRODUCT_PRICE_NEGATIVE_ERROR,
  });

export function assertCanonicalProductPrices(input: {
  buyPrice?: number;
  sellPrice?: number;
  purchasePrice?: number;
}): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const [field, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const validated = validateProductPriceValue(value);
    if (!validated.ok) {
      errors[field] = [validated.message];
    }
  }

  return errors;
}
