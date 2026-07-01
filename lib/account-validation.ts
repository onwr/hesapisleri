import { z } from "zod";
import { parseTurkishMoneyInput } from "@/lib/money-input-utils";

export const OPENING_BALANCE_MIN_MESSAGE =
  "Açılış bakiyesi sıfırdan küçük olamaz.";

const INVALID_ACCOUNT_NAME_MESSAGE =
  "Hesap adında geçersiz karakter bulunuyor.";

const CONTROL_OR_TAG_PATTERN = /[\x00-\x1F\x7F]|[<>]/;
const SCRIPT_TAG_PATTERN = /<\s*script/i;

export function isValidAccountName(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  if (CONTROL_OR_TAG_PATTERN.test(trimmed)) return false;
  if (SCRIPT_TAG_PATTERN.test(trimmed)) return false;
  return true;
}

export const accountNameFieldSchema = z
  .string()
  .trim()
  .min(2, "Hesap adı en az 2 karakter olmalıdır.")
  .max(100, "Hesap adı en fazla 100 karakter olabilir.")
  .refine(isValidAccountName, INVALID_ACCOUNT_NAME_MESSAGE);

export const openingBalanceFieldSchema = z
  .number()
  .finite("Geçerli bir tutar girin.")
  .min(0, OPENING_BALANCE_MIN_MESSAGE);

export function parseOpeningBalanceInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = parseTurkishMoneyInput(trimmed);
  if (!Number.isFinite(parsed)) return NaN;
  return parsed;
}

export function validateOpeningBalanceInput(value: string) {
  const parsed = parseOpeningBalanceInput(value);
  const result = openingBalanceFieldSchema.safeParse(parsed);
  if (result.success) {
    return { ok: true as const, value: result.data };
  }
  const flattened = result.error.flatten();
  const fieldError = Object.values(flattened.fieldErrors)[0]?.[0];
  const message =
    flattened.formErrors[0] ?? fieldError ?? "Geçerli bir tutar girin.";
  return { ok: false as const, message };
}

export const accountFormClientSchema = z.object({
  name: accountNameFieldSchema,
  type: z.enum(["CASH", "BANK", "CREDIT_CARD", "POS", "OTHER"]),
  bankName: z.string().optional(),
  openingBalance: z.string().optional(),
  currency: z.string().trim().min(1, "Para birimi zorunludur.").default("TRY"),
  isDefault: z.boolean().optional(),
  description: z.string().optional(),
});

export function validateAccountCreateForm(input: {
  name: string;
  type: string;
  bankName?: string;
  openingBalance?: string;
  currency?: string;
}) {
  const errors: Record<string, string> = {};

  const nameResult = accountNameFieldSchema.safeParse(input.name);
  if (!nameResult.success) {
    errors.name = nameResult.error.flatten().formErrors[0] ?? "Hesap adı geçersiz.";
  }

  if (input.type === "BANK" && !input.bankName?.trim()) {
    errors.bankName = "Banka adı zorunludur.";
  }

  const opening = validateOpeningBalanceInput(input.openingBalance ?? "0");
  if (!opening.ok) {
    errors.openingBalance = opening.message;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false as const, errors };
  }

  return {
    ok: true as const,
    payload: {
      name: nameResult.success ? nameResult.data : input.name.trim(),
      type: input.type,
      bankName: input.bankName?.trim() || undefined,
      openingBalance: opening.ok ? opening.value : 0,
      currency: input.currency?.trim() || "TRY",
    },
  };
}
