/**
 * Ana sayfa erişilebilirlik render testi — GERÇEK render (react-dom/server
 * renderToStaticMarkup) üzerinden üretilen HTML'i tarar, statik grep DEĞİL.
 * DB gerektirmez (bileşenler saf props alır, PricingSection'a mock plan
 * verisi geçilir).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import type { PublicPlan } from "@/lib/marketing/public-plan-service";

const mockPlan: PublicPlan = {
  id: "plan-1",
  name: "Standart",
  code: "standard",
  slug: "standart",
  shortDescription: "Test paketi",
  badgeText: null,
  isFeatured: true,
  monthlyPrice: 499,
  yearlyPrice: 4990,
  annualEquivalentMonthlyPrice: 416,
  showAnnualDiscount: true,
  currency: "TRY",
  features: ["Satış", "Stok", "Fatura"],
  trialEnabled: true,
  trialDays: 14,
  billingPeriods: ["MONTHLY", "YEARLY"],
  isPurchasable: true,
};

function renderSection(component: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(component);
}

/**
 * `<a ...>...</a>` bloklarını çıkarır (basit, iç içe <a> olmayan bir sayfa
 * için yeterli — homepage'de nested anchor yok). Her blok için: attribute
 * string'i ve düz metne indirgenmiş (tag'siz) iç içerik döner.
 */
function extractAnchors(html: string) {
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
  const anchors: Array<{ attrs: string; text: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const attrs = match[1] ?? "";
    const innerHtml = match[2] ?? "";
    const text = innerHtml
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    anchors.push({ attrs, text });
  }
  return anchors;
}

function hasAccessibleName(anchor: { attrs: string; text: string }) {
  if (anchor.text.length > 0) return true;
  if (/aria-label="[^"]+"/.test(anchor.attrs)) return true;
  if (/aria-labelledby="[^"]+"/.test(anchor.attrs)) return true;
  return false;
}

const SECTIONS: Array<{ name: string; html: string }> = [
  {
    name: "MarketingHeader",
    html: renderSection(
      createElement(MarketingHeader, { registrationEnabled: true, trialDays: 14 })
    ),
  },
  {
    name: "HeroSection",
    html: renderSection(
      createElement(HeroSection, {
        registrationEnabled: true,
        trialDays: 14,
        brandName: "Hesap İşleri",
      })
    ),
  },
  { name: "AiInsightsSection", html: renderSection(createElement(AiInsightsSection)) },
  { name: "ModulesSection", html: renderSection(createElement(ModulesSection)) },
  { name: "IntegrationsSection", html: renderSection(createElement(IntegrationsSection)) },
  { name: "ComparisonSection", html: renderSection(createElement(ComparisonSection)) },
  { name: "SecuritySection", html: renderSection(createElement(SecuritySection)) },
  {
    name: "MobileExperienceSection",
    html: renderSection(createElement(MobileExperienceSection)),
  },
  {
    name: "PricingSection",
    html: renderSection(
      createElement(PricingSection, { plans: [mockPlan], registrationEnabled: true })
    ),
  },
  { name: "FaqSection", html: renderSection(createElement(FaqSection)) },
  {
    name: "FinalCtaSection",
    html: renderSection(
      createElement(FinalCtaSection, { registrationEnabled: true, trialDays: 14 })
    ),
  },
  {
    name: "MarketingFooter",
    html: renderSection(
      createElement(MarketingFooter, {
        brandName: "Hesap İşleri",
        supportEmail: "destek@hesapisleri.com",
        supportPhone: "+90 555 000 00 00",
        websiteUrl: "https://hesapisleri.com",
      })
    ),
  },
];

describe("Ana sayfa — <a> erişilebilirlik render testi (gerçek renderToStaticMarkup)", () => {
  for (const section of SECTIONS) {
    it(`${section.name}: tüm <a> etiketleri erişilebilir isme sahip (metin veya aria-label)`, () => {
      const anchors = extractAnchors(section.html);
      const emptyAnchors = anchors.filter((a) => !hasAccessibleName(a));
      assert.equal(
        emptyAnchors.length,
        0,
        `${section.name} içinde erişilebilir ismi olmayan ${emptyAnchors.length} <a> bulundu: ${JSON.stringify(emptyAnchors)}`
      );
    });
  }

  it("tüm ana sayfa bölümlerinde toplam en az bir <a> render ediliyor (test kendi kendini boş geçmiyor)", () => {
    const totalAnchors = SECTIONS.reduce(
      (sum, section) => sum + extractAnchors(section.html).length,
      0
    );
    assert.ok(totalAnchors > 5, "ana sayfada beklenenden az link bulundu — render başarısız olmuş olabilir");
  });
});
