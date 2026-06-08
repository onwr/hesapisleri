import { z } from "zod";

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
  address: z.string().optional(),
  group: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

function trimOrNull(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeCustomerInput(data: CustomerFormValues) {
  return {
    name: data.name.trim(),
    phone: trimOrNull(data.phone),
    email: trimOrNull(data.email),
    taxNo: trimOrNull(data.taxNo),
    address: trimOrNull(data.address),
    group: trimOrNull(data.group) || "Genel",
  };
}

export function buildCustomerPayload(form: Record<string, string>): CustomerFormValues {
  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    taxNo: form.taxNo.trim(),
    address: form.address.trim(),
    group: form.group.trim(),
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
