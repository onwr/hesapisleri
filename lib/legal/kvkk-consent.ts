import { COMPANY_LEGAL_INFO } from "@/lib/legal/company-legal-info";

/** Aydınlatma metni sürümü — metin güncellendiğinde artırılmalıdır. */
export const KVKK_AYDINLATMA_VERSION = "2026-06-2";

/** Metnin yayımlandığı / son güncelleme tarihi (GG.AA.YYYY). */
export const KVKK_AYDINLATMA_LAST_UPDATED = "19.06.2026";

export const KVKK_AYDINLATMA_PATH = "/kvkk-aydinlatma-metni";

/** Kayıt ekranındaki bilgilendirme ifadesi — açık rıza metni değildir. */
export const KVKK_AYDINLATMA_ACKNOWLEDGMENT_TEXT =
  "Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni'ni okudum ve bilgilendirildim.";

export const MARKETING_CONSENT_VERSION = "2026-06-1";

export const MARKETING_CONSENT_TEXT =
  `${COMPANY_LEGAL_INFO.brandName} tarafından ürün, hizmet, kampanya ve duyurular hakkında ` +
  "e-posta, SMS ve diğer elektronik iletişim kanalları üzerinden ticari ileti gönderilmesini kabul ediyorum.";

/** Denetim kaydı için sürüm, gösterim tarihi ve bilgilendirme ifadesi. */
export function buildKvkkAcknowledgmentRecord(): string {
  return [
    KVKK_AYDINLATMA_ACKNOWLEDGMENT_TEXT,
    `Metin sürümü: ${KVKK_AYDINLATMA_VERSION}`,
    `Gösterim tarihi: ${KVKK_AYDINLATMA_LAST_UPDATED}`,
  ].join(" | ");
}

/** @deprecated KVKK_AYDINLATMA_VERSION kullanın */
export const KVKK_CONSENT_VERSION = KVKK_AYDINLATMA_VERSION;
