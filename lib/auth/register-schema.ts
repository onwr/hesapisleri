import { z } from "zod";

/**
 * Register formunun tek canonical Zod şeması — client (register-form.tsx) ve
 * server (app/api/auth/register/route.ts) AYNI şemayı kullanır. Sessiz
 * başarısızlık kalmasın diye her alan için açık, Türkçe mesaj tanımlı.
 */

const CONTROL_CHARS_REGEX = new RegExp("[\\u0000-\\u001F\\u007F]");
const HTML_TAG_REGEX = /<[^>]*>/;

function safeTextField(options: { min: number; max: number; fieldLabel: string }) {
  return z
    .string()
    .trim()
    .min(options.min, `${options.fieldLabel} en az ${options.min} karakter olmalıdır.`)
    .max(options.max, `${options.fieldLabel} en fazla ${options.max} karakter olabilir.`)
    .refine((value) => !CONTROL_CHARS_REGEX.test(value), {
      message: `${options.fieldLabel} geçersiz karakter içeriyor.`,
    })
    .refine((value) => !HTML_TAG_REGEX.test(value), {
      message: `${options.fieldLabel} HTML etiketi içeremez.`,
    });
}

/** Register VE reset-password AYNI şifre kuralını kullanır (tek kaynak). */
export const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalıdır.")
  .max(128, "Şifre en fazla 128 karakter olabilir.");

/** Register VE forgot-password AYNI e-posta normalizasyonunu kullanır. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-posta en fazla 254 karakter olabilir.")
  .pipe(z.string().email("Geçerli bir e-posta adresi girin."));

export const registerSchema = z
  .object({
    name: safeTextField({ min: 2, max: 120, fieldLabel: "Ad soyad" }),
    email: emailSchema,
    phone: z.string().trim().max(32).optional(),
    password: passwordSchema,
    referralCode: z.string().trim().max(64).optional(),
    kvkkInformed: z.literal(true, {
      message: "Aydınlatma metnini onaylamalısınız.",
    }),
    marketingConsent: z.boolean().optional(),

    wantsCompanyInfo: z.boolean().optional(),

    companyName: safeTextField({ min: 2, max: 160, fieldLabel: "Firma adı" }).optional(),
    taxNo: z.string().trim().max(32).optional(),
    taxOffice: z.string().trim().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.wantsCompanyInfo && !data.companyName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Firma adı zorunludur.",
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const REGISTER_FIELD_ERROR_MESSAGES = {
  name: "Ad soyad alanı zorunludur.",
  email: "Geçerli bir e-posta adresi girin.",
  password: "Şifre en az 8 karakter olmalıdır.",
  companyName: "Firma adı zorunludur.",
  kvkkInformed: "Aydınlatma metnini onaylamalısınız.",
  emailTaken: "Bu e-posta adresiyle daha önce kayıt oluşturulmuş.",
} as const;
