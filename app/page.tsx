import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getPlatformSettings,
  getPlatformSettingsFallback,
} from "@/lib/admin/platform-settings/platform-settings-loader";
import { getPublicPlans } from "@/lib/marketing/public-plan-service";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { HeroSection } from "@/components/marketing/hero-section";
import { AiInsightsSection } from "@/components/marketing/ai-insights-section";
import { ModulesSection } from "@/components/marketing/modules-section";
import { IntegrationsSection } from "@/components/marketing/integrations-section";
import { ComparisonSection } from "@/components/marketing/comparison-section";
import { SecuritySection } from "@/components/marketing/security-section";
import { MobileExperienceSection } from "@/components/marketing/mobile-experience-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { ContactSection } from "@/components/marketing/contact-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings().catch(() => getPlatformSettingsFallback());
  const brandName = settings.brandName;
  const siteUrl = settings.websiteUrl || "https://hesapisleri.com";

  const title = `${brandName} | KOBİ'ler için İşletme Yönetim Platformu`;
  const description =
    "Satış, stok, e-fatura, kasa ve e-ticaret entegrasyonlarını tek platformda yönetin. Trendyol, Hepsiburada ve e-Fatura / e-Arşiv dahil.";

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: brandName,
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

function OrganizationSchema({
  brandName,
  siteUrl,
  supportEmail,
}: {
  brandName: string;
  siteUrl: string;
  supportEmail: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brandName,
    url: siteUrl,
    contactPoint: {
      "@type": "ContactPoint",
      email: supportEmail,
      contactType: "customer support",
      availableLanguage: "Turkish",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function SoftwareApplicationSchema({
  brandName,
  siteUrl,
}: {
  brandName: string;
  siteUrl: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brandName,
    url: siteUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "tr",
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function FaqSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Deneme süresi boyunca kredi kartı gerekiyor mu?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Hayır. Deneme sürecinizde herhangi bir ödeme bilgisi girmenize gerek yoktur.",
        },
      },
      {
        "@type": "Question",
        name: "Verilerim nerede saklanıyor?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tüm verileriniz Türkiye'deki sunucularda saklanmaktadır. Veri gizliliğini ön planda tutan altyapı kullanılmaktadır.",
        },
      },
      {
        "@type": "Question",
        name: "e-Fatura mükellefiyeti zorunlu mu?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Hayır. e-Fatura mükellefi değilseniz e-Arşiv faturası keserek kullanabilirsiniz.",
        },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function HomePage() {
  const [settings, plans] = await Promise.all([
    getPlatformSettings().catch(() => getPlatformSettingsFallback()),
    getPublicPlans(),
  ]);

  if (settings.maintenanceMode) {
    redirect("/maintenance");
  }

  const siteUrl = settings.websiteUrl || "https://hesapisleri.com";

  return (
    <>
      <OrganizationSchema
        brandName={settings.brandName}
        siteUrl={siteUrl}
        supportEmail={settings.supportEmail}
      />
      <SoftwareApplicationSchema brandName={settings.brandName} siteUrl={siteUrl} />
      <FaqSchema />

      <MarketingHeader
        registrationEnabled={settings.registrationEnabled}
        trialDays={settings.trialDays}
      />

      <main id="main-content" tabIndex={-1}>
        <HeroSection
          registrationEnabled={settings.registrationEnabled}
          trialDays={settings.trialDays}
          brandName={settings.brandName}
        />
        <AiInsightsSection />
        <ModulesSection />
        <IntegrationsSection />
        <ComparisonSection />
        <SecuritySection />
        <MobileExperienceSection />
        <PricingSection plans={plans} registrationEnabled={settings.registrationEnabled} />
        <FaqSection />
        <ContactSection supportEmail={settings.supportEmail} />
        <FinalCtaSection
          registrationEnabled={settings.registrationEnabled}
          trialDays={settings.trialDays}
        />
      </main>

      <MarketingFooter
        brandName={settings.brandName}
        supportEmail={settings.supportEmail}
        supportPhone={settings.supportPhone}
        websiteUrl={siteUrl}
      />
    </>
  );
}
