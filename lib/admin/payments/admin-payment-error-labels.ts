import { summarizeMembershipPaymentError } from "@/lib/admin/admin-overview-payment-labels";

export type NormalizedPaymentErrorCode =
  | "TIMEOUT"
  | "NETWORK"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_CREDENTIALS"
  | "INVALID_HASH"
  | "CALLBACK_VERIFICATION_FAILED"
  | "DUPLICATE_CALLBACK"
  | "INVALID_MERCHANT_OID"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "PAYMENT_REJECTED"
  | "CARD_BANK_REJECTED"
  | "INSUFFICIENT_INFORMATION"
  | "MANUAL_RENEWAL_NOT_SUPPORTED"
  | "NOT_SUPPORTED"
  | "UNKNOWN";

const LABELS: Record<NormalizedPaymentErrorCode, string> = {
  TIMEOUT: "Ödeme zaman aşımına uğradı",
  NETWORK: "Ağ bağlantı hatası",
  PROVIDER_UNAVAILABLE: "Ödeme sağlayıcısı geçici olarak kullanılamıyor",
  INVALID_CREDENTIALS: "Sağlayıcı kimlik bilgileri geçersiz",
  INVALID_HASH: "Callback imza doğrulaması başarısız",
  CALLBACK_VERIFICATION_FAILED: "Callback doğrulaması başarısız",
  DUPLICATE_CALLBACK: "Yinelenen callback (idempotent işlendi)",
  INVALID_MERCHANT_OID: "Geçersiz merchant OID",
  AMOUNT_MISMATCH: "Tutar uyuşmazlığı",
  CURRENCY_MISMATCH: "Para birimi uyuşmazlığı",
  PAYMENT_REJECTED: "Ödeme reddedildi",
  CARD_BANK_REJECTED: "Kart veya banka işlemi reddetti",
  INSUFFICIENT_INFORMATION: "Yetersiz ödeme bilgisi",
  MANUAL_RENEWAL_NOT_SUPPORTED: "Manuel yenileme modunda canlı sorgu desteklenmez",
  NOT_SUPPORTED: "Bu işlem desteklenmiyor",
  UNKNOWN: "Ödeme hatası",
};

export function normalizePaymentErrorCode(input: {
  failedReasonCode?: string | null;
  failedReasonMessage?: string | null;
  providerStatus?: string | null;
  lastError?: string | null;
}): NormalizedPaymentErrorCode {
  const blob = [
    input.failedReasonCode,
    input.failedReasonMessage,
    input.providerStatus,
    input.lastError,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (blob.includes("timeout") || blob.includes("zaman")) return "TIMEOUT";
  if (blob.includes("network") || blob.includes("ağ")) return "NETWORK";
  if (blob.includes("unavailable") || blob.includes("kullanılam")) return "PROVIDER_UNAVAILABLE";
  if (blob.includes("credential") || blob.includes("merchant key")) return "INVALID_CREDENTIALS";
  if (blob.includes("hash") || blob.includes("imza")) return "INVALID_HASH";
  if (blob.includes("tutar") && blob.includes("uyuş")) return "AMOUNT_MISMATCH";
  if (blob.includes("para birimi") || blob.includes("currency")) return "CURRENCY_MISMATCH";
  if (blob.includes("duplicate") || blob.includes("yinelen")) return "DUPLICATE_CALLBACK";
  if (blob.includes("merchant") && blob.includes("oid")) return "INVALID_MERCHANT_OID";
  if (blob.includes("3d") || blob.includes("kart") || blob.includes("banka"))
    return "CARD_BANK_REJECTED";
  if (blob.includes("insufficient") || blob.includes("yetersiz")) return "CARD_BANK_REJECTED";
  if (blob.includes("reject") || blob.includes("redd")) return "PAYMENT_REJECTED";
  if (blob.includes("not_supported") || blob.includes("desteklenmez")) return "NOT_SUPPORTED";
  return "UNKNOWN";
}

export function getSafePaymentErrorSummary(input: {
  status: string;
  failedReasonCode?: string | null;
  failedReasonMessage?: string | null;
  providerStatus?: string | null;
  lastError?: string | null;
}): string {
  const code = normalizePaymentErrorCode(input);
  if (code !== "UNKNOWN") return LABELS[code];
  return summarizeMembershipPaymentError(input);
}
