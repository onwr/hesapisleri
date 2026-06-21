import { z } from "zod";

export const ALLOWED_TAX_CERTIFICATE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type TaxCertificateMimeType =
  (typeof ALLOWED_TAX_CERTIFICATE_MIME_TYPES)[number];

export const MAX_TAX_CERTIFICATE_BYTES = 5 * 1024 * 1024;

export const customerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Müşteri adı en az 2 karakter olmalıdır."),
  phone: z.string().optional(),
  email: z
    .string()
    .trim()
    .email("Geçerli bir e-posta girin.")
    .optional()
    .or(z.literal("")),
  taxNo: z.string().optional(),
  taxOffice: z.string().optional(),
  taxCertificateUrl: z.string().optional(),
  taxCertificateFileName: z.string().optional(),
  taxCertificateMimeType: z.string().optional(),
  taxCertificateSize: z.number().int().nonnegative().optional().nullable(),
  address: z.string().optional(),
  group: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export type CustomerTaxCertificateInput = {
  taxCertificateUrl: string | null;
  taxCertificateFileName: string | null;
  taxCertificateMimeType: string | null;
  taxCertificateSize: number | null;
};

function trimOrNull(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function trimOrUndefined(value?: string | null) {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isAllowedTaxCertificateMimeType(
  mimeType: string | null | undefined
) {
  if (!mimeType) return false;
  return ALLOWED_TAX_CERTIFICATE_MIME_TYPES.includes(
    mimeType as TaxCertificateMimeType
  );
}

export function normalizeTaxCertificateInput(input: {
  taxCertificateUrl?: string | null;
  taxCertificateFileName?: string | null;
  taxCertificateMimeType?: string | null;
  taxCertificateSize?: number | null;
}): CustomerTaxCertificateInput {
  const url = trimOrNull(input.taxCertificateUrl);

  if (!url) {
    return {
      taxCertificateUrl: null,
      taxCertificateFileName: null,
      taxCertificateMimeType: null,
      taxCertificateSize: null,
    };
  }

  const mimeType = trimOrNull(input.taxCertificateMimeType);
  if (mimeType && !isAllowedTaxCertificateMimeType(mimeType)) {
    throw new Error("Vergi levhası dosya tipi desteklenmiyor.");
  }

  const size =
    typeof input.taxCertificateSize === "number" &&
    Number.isFinite(input.taxCertificateSize)
      ? Math.max(0, Math.trunc(input.taxCertificateSize))
      : null;

  if (size !== null && size > MAX_TAX_CERTIFICATE_BYTES) {
    throw new Error("Vergi levhası dosya boyutu 5MB'dan küçük olmalıdır.");
  }

  return {
    taxCertificateUrl: url,
    taxCertificateFileName: trimOrNull(input.taxCertificateFileName),
    taxCertificateMimeType: mimeType,
    taxCertificateSize: size,
  };
}

export function normalizeCustomerInput(data: CustomerFormValues) {
  const taxCertificate = normalizeTaxCertificateInput({
    taxCertificateUrl: data.taxCertificateUrl,
    taxCertificateFileName: data.taxCertificateFileName,
    taxCertificateMimeType: data.taxCertificateMimeType,
    taxCertificateSize: data.taxCertificateSize ?? null,
  });

  return {
    name: data.name.trim(),
    phone: trimOrNull(data.phone),
    email: trimOrNull(data.email),
    taxNo: trimOrNull(data.taxNo),
    taxOffice: trimOrNull(data.taxOffice),
    address: trimOrNull(data.address),
    group: trimOrNull(data.group) || "Genel",
    ...taxCertificate,
  };
}

export function buildCustomerPayload(
  form: Record<string, string | number | null | undefined>
): CustomerFormValues {
  const sizeValue = form.taxCertificateSize;
  const parsedSize =
    typeof sizeValue === "number"
      ? sizeValue
      : typeof sizeValue === "string" && sizeValue.trim().length > 0
        ? Number.parseInt(sizeValue, 10)
        : undefined;

  return {
    name: String(form.name ?? "").trim(),
    phone: String(form.phone ?? "").trim(),
    email: String(form.email ?? "").trim(),
    taxNo: String(form.taxNo ?? "").trim(),
    taxOffice: String(form.taxOffice ?? "").trim(),
    address: String(form.address ?? "").trim(),
    group: String(form.group ?? "").trim(),
    taxCertificateUrl: trimOrUndefined(String(form.taxCertificateUrl ?? "")),
    taxCertificateFileName: trimOrUndefined(
      String(form.taxCertificateFileName ?? "")
    ),
    taxCertificateMimeType: trimOrUndefined(
      String(form.taxCertificateMimeType ?? "")
    ),
    taxCertificateSize:
      parsedSize !== undefined && Number.isFinite(parsedSize)
        ? parsedSize
        : undefined,
  };
}

export function mapCustomerFieldErrors(
  errors: Record<string, string[] | undefined> | undefined
) {
  if (!errors) return {};

  return Object.fromEntries(
    Object.entries(errors)
      .filter(([, messages]) => messages && messages.length > 0)
      .map(([key, messages]) => [key, messages![0]!])
  ) as Record<string, string>;
}

export function getFirstCustomerErrorMessage(
  message: string | undefined,
  errors: Record<string, string[] | undefined> | undefined
) {
  const fieldErrors = mapCustomerFieldErrors(errors);
  const firstFieldError = Object.values(fieldErrors)[0];
  return firstFieldError || message || "İşlem tamamlanamadı.";
}

export function hasCustomerTaxCertificate(input: {
  taxCertificateUrl?: string | null;
}) {
  return Boolean(trimOrNull(input.taxCertificateUrl));
}

export function getCustomerTaxInfoStatus(input: {
  taxNo?: string | null;
  taxOffice?: string | null;
  taxCertificateUrl?: string | null;
}) {
  const hasTaxNo = Boolean(trimOrNull(input.taxNo));
  const hasTaxOffice = Boolean(trimOrNull(input.taxOffice));
  const hasCertificate = hasCustomerTaxCertificate(input);

  if (hasTaxOffice && hasCertificate) {
    return "complete" as const;
  }

  if (!hasTaxNo && !hasTaxOffice && !hasCertificate) {
    return "missing" as const;
  }

  return "partial" as const;
}
