import { z } from "zod";
import { emailSchema } from "@/lib/auth/register-schema";

const CONTROL_CHARS_REGEX = new RegExp("[\\u0000-\\u001F\\u007F]");
const HTML_TAG_REGEX = /<[^>]*>/;

function safeText(options: { min: number; max: number; fieldLabel: string }) {
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

export const contactFormSchema = z.object({
  name: safeText({ min: 2, max: 120, fieldLabel: "Ad soyad" }),
  email: emailSchema,
  subject: safeText({ min: 2, max: 160, fieldLabel: "Konu" }),
  message: safeText({ min: 10, max: 4000, fieldLabel: "Mesaj" }),
  consent: z.literal(true, { message: "Aydınlatma metnini onaylamalısınız." }),
  // Honeypot — botlar bu alanı da doldurur, gerçek kullanıcı görmez/doldurmaz.
  // BİLİNÇLİ OLARAK burada reddedilmiyor (max(0) vb.) — dolu honeypot şema
  // validasyonunu geçmeli ki route katmanı botu "başarılıymış gibi" sessizce
  // savuşturabilsin (400 dönmek botu input'unun reddedildiğini anlamasına
  // ve honeypot'u tespit etmesine yol açar).
  website: z.string().max(500).optional().default(""),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const CONTACT_FIELD_ERROR_MESSAGES = {
  name: "Ad soyad alanı zorunludur.",
  email: "Geçerli bir e-posta adresi girin.",
  subject: "Konu alanı zorunludur.",
  message: "Mesajınız en az 10 karakter olmalıdır.",
  consent: "Aydınlatma metnini onaylamalısınız.",
} as const;
