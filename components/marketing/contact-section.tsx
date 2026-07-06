import { Mail } from "lucide-react";
import { isMailConfigured } from "@/lib/mail-service";
import { ContactForm } from "@/components/marketing/contact-form";

type Props = {
  supportEmail: string;
};

/**
 * Mail altyapısı yapılandırılmamışsa (bkz. lib/mail-service.ts) form
 * gösterilmez — kullanıcıya "aktif" gibi görünüp sessizce başarısız olan bir
 * form sunmak yerine açık iletişim e-postası gösterilir.
 */
export function ContactSection({ supportEmail }: Props) {
  const mailReady = isMailConfigured();

  return (
    <section id="iletisim" className="bg-white py-20">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-600">
            İletişim
          </p>
          <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Bize ulaşın</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
            Sorularınız için formu doldurun, en kısa sürede size dönüş yapalım.
          </p>
        </div>

        {mailReady ? (
          <ContactForm />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <Mail className="mx-auto mb-3 size-6 text-blue-600" />
            <p className="text-sm text-slate-600">
              Bize doğrudan e-posta ile ulaşabilirsiniz:
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="mt-2 inline-block font-bold text-blue-600 hover:text-blue-700"
            >
              {supportEmail}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
