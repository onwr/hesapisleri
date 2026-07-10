import type { CompanyLegalInfo } from "@/lib/legal/company-legal-info";
import { getPlatformLegalInfoFallback } from "@/lib/legal/company-legal-info";
import {
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_VERSION,
} from "@/lib/legal/privacy-policy";
import { KVKK_AYDINLATMA_PATH } from "@/lib/legal/kvkk-consent";

const sectionTitleClass =
  "mt-8 text-base font-bold text-[#0f1f4d] first:mt-0";
const bodyClass = "mt-3 text-sm leading-7 text-slate-700";
const listClass =
  "mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-700";

type PrivacyPolicyContentProps = {
  legalInfo?: CompanyLegalInfo;
};

export function PrivacyPolicyContent({
  legalInfo = getPlatformLegalInfoFallback(),
}: PrivacyPolicyContentProps) {
  const { tradeName, address, kvkkEmail, phone, website, brandName } = legalInfo;

  return (
    <article>
      <header className="border-b border-slate-100 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {brandName} Gizlilik Politikası
        </p>
        <h1 className="mt-2 text-xl font-black text-[#0f1f4d]">
          Gizlilik Politikası
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Sürüm: {PRIVACY_POLICY_VERSION} · Son güncelleme:{" "}
          {PRIVACY_POLICY_LAST_UPDATED}
        </p>
      </header>

      <section>
        <h2 className={sectionTitleClass}>1. Veri sorumlusu</h2>
        <p className={bodyClass}>
          Bu politika, <strong>{brandName}</strong> hizmetini kullanırken
          işlenen kişisel verilere ilişkin genel gizlilik ilkelerini açıklar.
          Veri sorumlusu: <strong>{tradeName}</strong>.
        </p>
        <ul className={listClass}>
          <li>
            <strong>Adres:</strong> {address}
          </li>
          <li>
            <strong>İletişim:</strong>{" "}
            <a
              href={`mailto:${kvkkEmail}`}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              {kvkkEmail}
            </a>
          </li>
          {phone ? (
            <li>
              <strong>Telefon:</strong> {phone}
            </li>
          ) : null}
          <li>
            <strong>Web:</strong> {website}
          </li>
        </ul>
      </section>

      <section>
        <h2 className={sectionTitleClass}>2. İşlenen veri kategorileri</h2>
        <ul className={listClass}>
          <li>Kimlik ve iletişim bilgileri (ad, e-posta, telefon)</li>
          <li>Hesap ve oturum bilgileri</li>
          <li>Firma, müşteri, tedarikçi ve operasyonel iş kayıtları</li>
          <li>Fatura, ödeme ve abonelik işlem kayıtları</li>
          <li>Teknik loglar, güvenlik ve kullanım kayıtları</li>
        </ul>
      </section>

      <section>
        <h2 className={sectionTitleClass}>3. İşleme amaçları</h2>
        <ul className={listClass}>
          <li>Hesap oluşturma, kimlik doğrulama ve hizmet sunumu</li>
          <li>Ürün güvenliği, dolandırıcılık önleme ve sistem güvenliği</li>
          <li>Destek taleplerinin yanıtlanması</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Açık rıza verilmişse ticari ileti gönderimi</li>
        </ul>
      </section>

      <section>
        <h2 className={sectionTitleClass}>4. Hukuki sebepler</h2>
        <p className={bodyClass}>
          Kişisel veriler; sözleşmenin kurulması veya ifası, hukuki
          yükümlülük, meşru menfaat ve açık rıza hallerinde KVKK kapsamında
          işlenir. Kayıt aydınlatması için{" "}
          <a
            href={KVKK_AYDINLATMA_PATH}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            KVKK Aydınlatma Metni
          </a>{" "}
          ayrıca yayımlanır.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>5. Veri aktarımı</h2>
        <p className={bodyClass}>
          Veriler; barındırma, e-posta, ödeme ve entegrasyon hizmet sağlayıcıları
          ile yalnızca hizmetin sunulması için gerekli ölçüde paylaşılabilir.
          Yurt dışı aktarım söz konusu olduğunda KVKK&apos;daki şartlara uygun
          teknik ve sözleşmesel önlemler uygulanır.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>6. Saklama süreleri</h2>
        <p className={bodyClass}>
          Veriler, işleme amacının gerektirdiği süre boyunca ve ilgili mevzuat
          yükümlülükleri kapsamında saklanır; süre sonunda silinir, anonimleştirilir
          veya erişime kapatılır.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>7. Çerezler</h2>
        <p className={bodyClass}>
          Oturum yönetimi ve güvenlik için zorunlu çerezler kullanılır.
          &quot;Beni hatırla&quot; seçeneği işaretlendiğinde oturum çerezi daha
          uzun süreli tutulabilir; işaretlenmediğinde tarayıcı oturumu kapanınca
          sona erer.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>8. Haklarınız</h2>
        <p className={bodyClass}>
          KVKK kapsamında; verilerinize erişme, düzeltme, silme, işlemeyi
          kısıtlama, itiraz etme ve veri taşınabilirliği taleplerinde bulunma
          haklarına sahipsiniz. Taleplerinizi {kvkkEmail} adresine iletebilirsiniz.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>9. Güncellemeler</h2>
        <p className={bodyClass}>
          Bu politika güncellenebilir. Güncel sürüm bu sayfada yayımlanır.
          Önemli değişikliklerde kullanıcılar uygun kanallarla bilgilendirilir.
        </p>
        <p className={`${bodyClass} text-xs text-slate-500`}>
          Bu metin genel bilgilendirme amaçlıdır; hukuki inceleme önerilir.
        </p>
      </section>
    </article>
  );
}
