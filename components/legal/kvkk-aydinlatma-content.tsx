import type { CompanyLegalInfo } from "@/lib/legal/company-legal-info";
import { getPlatformLegalInfoFallback } from "@/lib/legal/company-legal-info";
import {
  KVKK_AYDINLATMA_LAST_UPDATED,
  KVKK_AYDINLATMA_VERSION,
} from "@/lib/legal/kvkk-consent";

const sectionTitleClass =
  "mt-8 text-base font-bold text-[#0f1f4d] first:mt-0";
const bodyClass = "mt-3 text-sm leading-7 text-slate-700";
const listClass = "mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-700";

type KvkkAydinlatmaContentProps = {
  showHeader?: boolean;
  legalInfo?: CompanyLegalInfo;
};

export function KvkkAydinlatmaContent({
  showHeader = true,
  legalInfo = getPlatformLegalInfoFallback(),
}: KvkkAydinlatmaContentProps) {
  const { tradeName, address, kvkkEmail, phone, kepAddress, website } = legalInfo;

  return (
    <article>
      {showHeader ? (
        <header className="border-b border-slate-100 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hesap İşleri Kayıt Aydınlatma Metni
          </p>
          <h1 className="mt-2 text-xl font-black text-[#0f1f4d]">
            Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            Sürüm: {KVKK_AYDINLATMA_VERSION} · Son güncelleme:{" "}
            {KVKK_AYDINLATMA_LAST_UPDATED}
          </p>
        </header>
      ) : null}

      <section className={bodyClass}>
        <h2 className={sectionTitleClass}>1. Veri sorumlusu</h2>
        <p className={bodyClass}>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;)
          kapsamında kişisel verileriniz, veri sorumlusu sıfatıyla{" "}
          <strong>{tradeName}</strong> tarafından işlenmektedir.
        </p>
        <p className={bodyClass}>Veri sorumlusu bilgileri:</p>
        <ul className={listClass}>
          <li>
            <strong>Ticari unvan:</strong> {tradeName}
          </li>
          <li>
            <strong>Adres:</strong> {address}
          </li>
          <li>
            <strong>E-posta:</strong>{" "}
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
            <strong>İnternet sitesi:</strong>{" "}
            <a
              href={website}
              className="font-semibold text-blue-600 hover:text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              {website}
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2 className={sectionTitleClass}>2. İşlenen kişisel veriler</h2>
        <p className={bodyClass}>
          Hesap İşleri platformuna üyelik oluşturmanız ve hizmetlerden
          yararlanmanız kapsamında aşağıdaki kişisel verileriniz
          işlenebilmektedir:
        </p>
        <ul className={listClass}>
          <li>
            <strong>Kimlik bilgileri:</strong> Ad, soyadı ve kullanıcı kimlik
            bilgileri
          </li>
          <li>
            <strong>İletişim bilgileri:</strong> E-posta adresi, telefon
            numarası ve iletişim adresi
          </li>
          <li>
            <strong>Müşteri ve firma bilgileri:</strong> Firma adı, vergi
            dairesi, vergi numarası, firma yetkilisi ve firma iletişim
            bilgileri
          </li>
          <li>
            <strong>Hesap ve işlem bilgileri:</strong> Kullanıcı rolü, üyelik
            planı, abonelik durumu, işlem geçmişi, tercih ve ayarlar
          </li>
          <li>
            <strong>Finansal işlem bilgileri:</strong> Ödeme tutarı, ödeme
            durumu, fatura ve abonelik bilgileri, ödeme kuruluşu tarafından
            oluşturulan işlem numaraları
          </li>
          <li>
            <strong>İşlem güvenliği bilgileri:</strong> IP adresi, giriş-çıkış
            kayıtları, cihaz ve tarayıcı bilgileri, güvenlik ve hata kayıtları
          </li>
          <li>
            <strong>Talep ve destek bilgileri:</strong> Destek talepleri,
            şikâyetler, görüşmeler ve tarafımıza ilettiğiniz mesajlar
          </li>
          <li>
            <strong>Pazarlama bilgileri:</strong> Yalnızca ayrıca izin
            vermeniz hâlinde kampanya, tanıtım ve iletişim tercihleri
          </li>
        </ul>
        <p className={bodyClass}>
          Şifreleriniz açık metin olarak değil, uygun güvenlik yöntemleri
          uygulanarak saklanır.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>
          3. Kişisel verilerin işlenme amaçları
        </h2>
        <p className={bodyClass}>
          Kişisel verileriniz aşağıdaki amaçlarla işlenebilir:
        </p>
        <ul className={listClass}>
          <li>Üyelik hesabınızın oluşturulması ve yönetilmesi</li>
          <li>Kimlik, kullanıcı ve firma bilgilerinizin doğrulanması</li>
          <li>Hesap İşleri yazılım hizmetlerinin sunulması</li>
          <li>
            Abonelik, paket, ek paket ve ödeme işlemlerinin yürütülmesi
          </li>
          <li>Fatura, tahsilat ve muhasebe süreçlerinin gerçekleştirilmesi</li>
          <li>Kullanıcı yetkilerinin ve erişim izinlerinin yönetilmesi</li>
          <li>Müşteri destek taleplerinin karşılanması</li>
          <li>
            Sistem güvenliğinin sağlanması ve yetkisiz erişimlerin önlenmesi
          </li>
          <li>
            Hata, kötüye kullanım ve dolandırıcılık girişimlerinin tespit
            edilmesi
          </li>
          <li>
            Hizmetlerin geliştirilmesi, performans ve kullanım analizlerinin
            yapılması
          </li>
          <li>
            Yasal saklama, bildirim ve diğer hukuki yükümlülüklerin yerine
            getirilmesi
          </li>
          <li>Hukuki uyuşmazlıklarda hakların kullanılması ve korunması</li>
          <li>
            Açık ileti izni vermeniz hâlinde kampanya, duyuru ve tanıtımların
            gönderilmesi
          </li>
        </ul>
      </section>

      <section>
        <h2 className={sectionTitleClass}>
          4. Kişisel verilerin işlenmesinin hukuki sebepleri
        </h2>
        <p className={bodyClass}>
          Kişisel verileriniz KVKK&apos;nın 5&apos;inci maddesinde belirtilen
          aşağıdaki hukuki sebeplere dayanılarak işlenmektedir:
        </p>
        <ul className={listClass}>
          <li>
            Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili
            olması
          </li>
          <li>
            Veri sorumlusunun hukuki yükümlülüklerini yerine getirebilmesi için
            zorunlu olması
          </li>
          <li>
            Bir hakkın tesisi, kullanılması veya korunması için veri işlemenin
            zorunlu olması
          </li>
          <li>
            Temel hak ve özgürlüklerinize zarar vermemek kaydıyla veri
            sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu
            olması
          </li>
          <li>Kanunlarda açıkça öngörülmesi</li>
          <li>Gerekli olduğu hâllerde açık rızanızın bulunması</li>
        </ul>
        <p className={bodyClass}>
          Kayıt ve hizmet sunumu için zorunlu olmayan pazarlama faaliyetleri,
          ayrıca vereceğiniz tercihe veya ilgili mevzuatta bulunan diğer hukuki
          sebeplere göre yürütülür.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>
          5. Kişisel verilerin toplanma yöntemi
        </h2>
        <p className={bodyClass}>Kişisel verileriniz;</p>
        <ul className={listClass}>
          <li>Kayıt ve giriş formları</li>
          <li>Hesap ve firma ayarları</li>
          <li>Abonelik ve ödeme ekranları</li>
          <li>Destek ve iletişim kanalları</li>
          <li>İnternet sitesi ve uygulama kullanımı</li>
          <li>Çerezler, log kayıtları ve benzeri teknik yöntemler</li>
          <li>
            Yetkili ödeme, barındırma, e-posta, SMS ve altyapı hizmeti
            sağlayıcıları
          </li>
        </ul>
        <p className={bodyClass}>
          aracılığıyla otomatik veya kısmen otomatik yöntemlerle elektronik
          ortamda toplanabilir.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>6. Kişisel verilerin aktarılması</h2>
        <p className={bodyClass}>
          Kişisel verileriniz, yukarıdaki amaçların gerçekleştirilmesi ve
          gerekli güvenlik tedbirlerinin alınması şartıyla aşağıdaki alıcı
          gruplarına aktarılabilir:
        </p>
        <ul className={listClass}>
          <li>
            Yetkili çalışanlar ve hizmetin yürütülmesinde görev alan iş
            ortakları
          </li>
          <li>
            Sunucu, barındırma, yedekleme ve yazılım altyapısı sağlayıcıları
          </li>
          <li>
            Ödeme kuruluşları, bankalar ve finansal hizmet sağlayıcıları
          </li>
          <li>
            E-posta, SMS, bildirim ve müşteri destek hizmeti sağlayıcıları
          </li>
          <li>Muhasebe, mali müşavirlik ve hukuk danışmanları</li>
          <li>Kanunen yetkili kamu kurumları, mahkemeler ve icra mercileri</li>
          <li>
            Hukuki yükümlülükler kapsamında yetkili diğer kişi ve kuruluşlar
          </li>
        </ul>
        <p className={bodyClass}>
          Kişisel verileriniz, hizmetlerin sunulması için gerekli olmayan
          üçüncü kişilere satılmaz.
        </p>
        <p className={bodyClass}>
          Yurt dışında bulunan bir bulut, e-posta, analiz veya altyapı
          sağlayıcısı kullanılması hâlinde, yurt dışına veri aktarım
          süreçleri KVKK&apos;nın ilgili hükümleri ve yürürlükteki aktarım
          şartlarına uygun şekilde yürütülür.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>
          7. Kişisel verilerin saklanma süresi
        </h2>
        <p className={bodyClass}>Kişisel verileriniz;</p>
        <ul className={listClass}>
          <li>Üyelik ve hizmet ilişkisinin devam ettiği süre boyunca,</li>
          <li>İlgili mevzuatta öngörülen zorunlu saklama sürelerince,</li>
          <li>
            Hukuki uyuşmazlıklarda hakların kullanılabilmesi için gerekli
            zamanaşımı süreleri boyunca
          </li>
        </ul>
        <p className={bodyClass}>saklanabilir.</p>
        <p className={bodyClass}>
          İşleme amacı ve hukuki saklama zorunluluğu sona eren kişisel
          veriler, mevzuata uygun şekilde silinir, yok edilir veya anonim hâle
          getirilir.
        </p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>8. İlgili kişinin hakları</h2>
        <p className={bodyClass}>
          KVKK&apos;nın 11&apos;inci maddesi kapsamında;
        </p>
        <ul className={listClass}>
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
          <li>
            İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını
            öğrenme,
          </li>
          <li>
            Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri öğrenme,
          </li>
          <li>Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme,</li>
          <li>
            Kanunda belirtilen şartlar kapsamında verilerin silinmesini veya
            yok edilmesini isteme,
          </li>
          <li>
            Düzeltme, silme veya yok etme işlemlerinin verilerin aktarıldığı
            üçüncü kişilere bildirilmesini isteme,
          </li>
          <li>
            İşlenen verilerin yalnızca otomatik sistemlerle analiz edilmesi
            sonucunda aleyhinize bir sonucun ortaya çıkmasına itiraz etme,
          </li>
          <li>
            Kanuna aykırı veri işlenmesi nedeniyle zarara uğramanız hâlinde
            zararın giderilmesini talep etme
          </li>
        </ul>
        <p className={bodyClass}>haklarına sahipsiniz.</p>
      </section>

      <section>
        <h2 className={sectionTitleClass}>9. Başvuru yöntemi</h2>
        <p className={bodyClass}>
          KVKK kapsamındaki taleplerinizi aşağıdaki yöntemlerle tarafımıza
          iletebilirsiniz:
        </p>
        <ul className={listClass}>
          <li>
            <strong>Yazılı olarak:</strong> {address}
          </li>
          <li>
            <strong>E-posta yoluyla:</strong>{" "}
            <a
              href={`mailto:${kvkkEmail}`}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              {kvkkEmail}
            </a>
          </li>
          {kepAddress ? (
            <li>
              <strong>KEP yoluyla:</strong> {kepAddress}
            </li>
          ) : null}
          <li>
            Sistem üzerinde sunulan destek veya başvuru kanalı üzerinden
          </li>
        </ul>
        <p className={bodyClass}>
          Başvurunuzda adınızın, soyadınızın, talep konusunun ve kimliğinizi
          doğrulamaya yardımcı gerekli bilgilerin bulunması gerekmektedir.
          Başvurular, ilgili mevzuatta öngörülen süreler içinde
          değerlendirilir.
        </p>
        <p className="mt-6 text-xs text-slate-500">
          Son güncelleme tarihi: {KVKK_AYDINLATMA_LAST_UPDATED}
        </p>
      </section>
    </article>
  );
}
