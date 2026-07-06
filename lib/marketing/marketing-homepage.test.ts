import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function src(...segments: string[]): string {
  return readFileSync(join(webRoot, ...segments), "utf8");
}

// ─── Homepage render structure ────────────────────────────────────────────────

describe("Marketing homepage — app/page.tsx", () => {
  const page = src("app/page.tsx");

  it("renders MarketingHeader", () => {
    assert.match(page, /MarketingHeader/);
  });

  it("renders HeroSection", () => {
    assert.match(page, /HeroSection/);
  });

  it("renders AiInsightsSection", () => {
    assert.match(page, /AiInsightsSection/);
  });

  it("renders ModulesSection", () => {
    assert.match(page, /ModulesSection/);
  });

  it("renders IntegrationsSection", () => {
    assert.match(page, /IntegrationsSection/);
  });

  it("renders ComparisonSection", () => {
    assert.match(page, /ComparisonSection/);
  });

  it("renders SecuritySection", () => {
    assert.match(page, /SecuritySection/);
  });

  it("renders MobileExperienceSection", () => {
    assert.match(page, /MobileExperienceSection/);
  });

  it("renders PricingSection", () => {
    assert.match(page, /PricingSection/);
  });

  it("renders FaqSection", () => {
    assert.match(page, /FaqSection/);
  });

  it("renders FinalCtaSection", () => {
    assert.match(page, /FinalCtaSection/);
  });

  it("renders MarketingFooter", () => {
    assert.match(page, /MarketingFooter/);
  });

  it("does not import removed TrustSection", () => {
    assert.doesNotMatch(page, /TrustSection/);
  });

  it("does not import removed FeaturesSection", () => {
    assert.doesNotMatch(page, /FeaturesSection/);
  });

  it("does not import removed HowItWorksSection", () => {
    assert.doesNotMatch(page, /HowItWorksSection/);
  });

  it("does not import removed ProductShowcaseSection", () => {
    assert.doesNotMatch(page, /ProductShowcaseSection/);
  });
});

// ─── Anchor IDs ───────────────────────────────────────────────────────────────

describe("Section anchor IDs", () => {
  it("id=ozellikler exists in ai-insights-section", () => {
    assert.match(src("components/marketing/ai-insights-section.tsx"), /id="ozellikler"/);
  });

  it("id=moduller exists in modules-section", () => {
    assert.match(src("components/marketing/modules-section.tsx"), /id="moduller"/);
  });

  it("id=entegrasyonlar exists in integrations-section", () => {
    assert.match(src("components/marketing/integrations-section.tsx"), /id="entegrasyonlar"/);
  });

  it("id=fiyatlar exists in pricing-section", () => {
    assert.match(src("components/marketing/pricing-section.tsx"), /id="fiyatlar"/);
  });

  it("id=sss exists in faq-section", () => {
    assert.match(src("components/marketing/faq-section.tsx"), /id="sss"/);
  });

  it("id=iletisim exists (artık ayrı ContactSection'da — gerçek iletişim formu için taşındı)", () => {
    assert.match(src("components/marketing/contact-section.tsx"), /id="iletisim"/);
  });
});

// ─── Header ───────────────────────────────────────────────────────────────────

describe("MarketingHeader — navbar anchor links", () => {
  const header = src("components/marketing/marketing-header.tsx");

  it("has ozellikler anchor", () => { assert.match(header, /#ozellikler/); });
  it("has moduller anchor",    () => { assert.match(header, /#moduller/);   });
  it("has entegrasyonlar anchor", () => { assert.match(header, /#entegrasyonlar/); });
  it("has fiyatlar anchor",   () => { assert.match(header, /#fiyatlar/);   });
  it("has sss anchor",        () => { assert.match(header, /#sss/);        });
  it("has login link",        () => { assert.match(header, /\/login/);     });
  it("has register link",     () => { assert.match(header, /\/register/);  });

  it("accepts trialDays prop", () => {
    assert.match(header, /trialDays/);
  });

  it("shows trial text only when trialDays > 0", () => {
    assert.match(header, /trialDays > 0/);
  });

  it("has mobile menu with aria-label", () => {
    assert.match(header, /Mobil menü|mobile-menu/);
  });
});

// ─── Hero section ─────────────────────────────────────────────────────────────

describe("HeroSection — ekran.png & CTA", () => {
  const hero = src("components/marketing/hero-section.tsx");

  it("uses next/image with src /ekran.png", () => {
    assert.match(hero, /src="\/ekran\.png"/);
  });

  it("has correct alt text", () => {
    assert.match(hero, /Hesap İşleri işletme yönetim paneli demo ekranı/);
  });

  it("uses priority prop", () => {
    assert.match(hero, /priority/);
  });

  it("uses object-contain", () => {
    assert.match(hero, /object-contain/);
  });

  it("uses fill with sizes prop", () => {
    assert.match(hero, /fill/);
    assert.match(hero, /sizes=/);
  });

  it("uses aspect ratio from real ekran.png (1907x1080)", () => {
    assert.match(hero, /aspect-\[1907\/1080\]/);
  });

  it("shows Demo Ekranı label", () => {
    assert.match(hero, /Demo Ekranı/);
  });

  it("has browser frame traffic light dots", () => {
    assert.match(hero, /rose-5|rose-4/);
    assert.match(hero, /amber-4/);
    assert.match(hero, /emerald-5|emerald-4/);
  });

  it("has registrationEnabled CTA", () => {
    assert.match(hero, /registrationEnabled/);
    assert.ok(hero.includes('href="/register"'));
    assert.ok(hero.includes('href="/login"'));
  });

  it("has trialDays conditional", () => {
    assert.match(hero, /trialDays > 0/);
  });

  it("uses responsive grid (single col mobile, two col lg)", () => {
    assert.match(hero, /grid-cols-1/);
    assert.match(hero, /lg:grid-cols-/);
  });

  it("uses min-w-0 to prevent grid overflow", () => {
    assert.match(hero, /min-w-0/);
  });

  it("does not contain HERO_DEMO_STATS", () => {
    assert.doesNotMatch(hero, /HERO_DEMO_STATS/);
  });

  it("does not import hero-dashboard-preview", () => {
    assert.doesNotMatch(hero, /hero-dashboard-preview/);
  });

  it("hero-dashboard-preview.tsx file is deleted", () => {
    assert.ok(
      !existsSync(
        join(webRoot, "components/marketing/hero-dashboard-preview.tsx")
      )
    );
  });
});

// ─── AI Insights section ──────────────────────────────────────────────────────

describe("AiInsightsSection — safe content", () => {
  const section = src("components/marketing/ai-insights-section.tsx");

  it("has id=ozellikler anchor", () => {
    assert.match(section, /id="ozellikler"/);
  });

  it("contains Tahsilat Performansı card", () => {
    assert.match(section, /Tahsilat Performansı/);
  });

  it("contains Nakit Akışı card", () => {
    assert.match(section, /Nakit Akış/);
  });

  it("contains Geciken Ödemeler card", () => {
    assert.match(section, /Geciken Ödemeler/);
  });

  it("cards are marked as Demo", () => {
    assert.match(section, /Demo/);
  });

  it("does not claim 7/24 AI CFO or AI guarantee", () => {
    assert.doesNotMatch(section, /7\/24 CFO|AI CFO|yapay zekâ danışman/i);
  });

  it("does not contain base64 images", () => {
    assert.doesNotMatch(section, /data:image\/|base64,/);
  });

  it("does not use hardcoded real customer money amounts as guaranteed", () => {
    assert.doesNotMatch(section, /₺[0-9,.]+.*garanti|garanti.*₺/i);
  });
});

// ─── Modules section ─────────────────────────────────────────────────────────

describe("ModulesSection", () => {
  const mod = src("components/marketing/modules-section.tsx");

  it("has id=moduller anchor", () => {
    assert.match(mod, /id="moduller"/);
  });

  it("contains Finans Yönetimi module", () => {
    assert.match(mod, /Finans Yönetimi/);
  });

  it("contains Stok & Depo module", () => {
    assert.match(mod, /Stok.*Depo|Depo.*Stok/);
  });

  it("contains Pazaryeri Yönetimi module", () => {
    assert.match(mod, /Pazaryeri Yönetimi/);
  });

  it("contains e-Fatura module", () => {
    assert.match(mod, /e-Fatura/);
  });

  it("contains Raporlama module", () => {
    assert.match(mod, /Raporlama/);
  });

  it("does not claim native mobile app", () => {
    assert.doesNotMatch(mod, /App Store|Google Play|iOS & Android.*uygulama/i);
  });

  it("uses Mobil Uyumlu Panel instead of Mobil Uygulama", () => {
    assert.match(mod, /Mobil Uyumlu Panel/);
  });

  it("is a server component (no use client)", () => {
    assert.doesNotMatch(mod, /"use client"/);
  });
});

// ─── Integrations section ────────────────────────────────────────────────────

describe("IntegrationsSection — doğru entegrasyon içeriği", () => {
  const integ = src("components/marketing/integrations-section.tsx");
  const catalog = src("lib/marketing/integration-catalog.ts");

  it("has id=entegrasyonlar anchor", () => {
    assert.match(integ, /id="entegrasyonlar"/);
  });

  it("uses dark background", () => {
    assert.match(integ, /#07162D/);
  });

  it("shows Trendyol logo from public", () => {
    assert.match(catalog, /\/trendyol\.jpg/);
  });

  it("shows Hepsiburada logo from public", () => {
    assert.match(catalog, /\/hepsiburada\.png/);
  });

  it("shows N11 and ÇiçekSepeti logos without Yakında tag", () => {
    assert.match(catalog, /\/n11\.png/);
    assert.match(catalog, /\/ciceksepeti\.png/);
    assert.doesNotMatch(integ, /Yakında/);
    assert.match(integ, /bg-white/);
    assert.match(integ, /border-slate-100/);
  });

  it("does not show bank integration logos", () => {
    assert.doesNotMatch(integ, /garantibbva|isbankasi|vakifbank|Banka Entegrasyon/i);
  });

  it("does not show SMS integration card", () => {
    assert.doesNotMatch(integ, /SMS/);
  });

  it("does not show native Mobil Uygulama card", () => {
    assert.doesNotMatch(integ, /Mobil Uygulama|iOS & Android/i);
  });

  it("uses e-Fatura / e-Arşiv wording instead of direct GİB", () => {
    assert.match(catalog, /e-Fatura \/ e-Arşiv/);
    assert.doesNotMatch(integ, /GİB e-Fatura/);
  });

  it("shows Sipay as payment integration (aktif sağlayıcı PayTR'dan Sipay'e güncellendi)", () => {
    assert.match(integ, /Sipay/);
  });

  it("active marketplace keys match marketplace-types", () => {
    const types = src("lib/marketplace/marketplace-types.ts");
    assert.match(types, /"TRENDYOL" \| "HEPSIBURADA"/);
    assert.match(catalog, /key: "TRENDYOL"/);
    assert.match(catalog, /key: "HEPSIBURADA"/);
    assert.match(catalog, /ACTIVE_MARKETPLACE_KEYS/);
  });
});

// ─── Comparison section ───────────────────────────────────────────────────────

describe("ComparisonSection — real features, no fake stats", () => {
  const comp = src("components/marketing/comparison-section.tsx");

  it("has comparison table", () => {
    assert.match(comp, /<table|table/);
  });

  it("has Hesapişleri.com column header", () => {
    assert.match(comp, /Hesapişleri\.com|Hesap İşleri/);
  });

  it("contains Rol bazlı yetkilendirme row", () => {
    assert.match(comp, /Rol baz/);
  });

  it("contains Pazaryeri row", () => {
    assert.match(comp, /Pazaryeri/);
  });

  it("does not claim 100+ entegrasyon", () => {
    assert.doesNotMatch(comp, /100\+.*entegrasyon|entegrasyon.*100\+/);
  });

  it("does not claim rakiplerden N özellik fazla", () => {
    assert.doesNotMatch(comp, /rakip.*özellik fazla|50 gömlek/i);
  });
});

// ─── Security section ─────────────────────────────────────────────────────────

describe("SecuritySection — safe claims only", () => {
  const sec = src("components/marketing/security-section.tsx");

  it("contains Rol Bazlı Yetkilendirme", () => {
    assert.match(sec, /Rol Baz/);
  });

  it("contains Firma Bazlı Veri İzolasyonu", () => {
    assert.match(sec, /Firma Baz/i);
  });

  it("does not claim KVKK uyumlu certified compliance", () => {
    assert.doesNotMatch(sec, /KVKK Uyumlu|KVKK uyumlu/);
  });

  it("uses safe data privacy phrasing", () => {
    assert.match(sec, /Veri gizliliği/i);
  });

  it("does not claim 99.99% uptime guarantee", () => {
    assert.doesNotMatch(sec, /99\.99.*garanti|garanti.*uptime/i);
  });

  it("does not claim ISO SOC certification", () => {
    assert.doesNotMatch(sec, /ISO 27001|SOC 2|sertifika/i);
  });

  it("uses operational backup wording", () => {
    assert.match(sec, /Yedekleme ve Geri Yükleme/);
    assert.doesNotMatch(sec, /Düzenli Yedekleme Süreci|düzenli aralıklarla yedeklenir/i);
  });

  it("does not claim 256-bit SSL special guarantee", () => {
    assert.doesNotMatch(sec, /256.bit SSL.*garanti/i);
  });
});

// ─── Mobile experience section ────────────────────────────────────────────────

describe("MobileExperienceSection — no fake native app", () => {
  const mob = src("components/marketing/mobile-experience-section.tsx");

  it("does not show App Store button", () => {
    assert.doesNotMatch(mob, /App Store.*href|href.*App Store/);
    assert.doesNotMatch(mob, /apps\.apple\.com/);
  });

  it("does not show Google Play button", () => {
    assert.doesNotMatch(mob, /Google Play.*href|href.*Google Play/);
    assert.doesNotMatch(mob, /play\.google\.com/);
  });

  it("uses ekran.png for phone mockup", () => {
    assert.match(mob, /\/ekran\.png/);
  });

  it("labels as mobil uyumlu web paneli", () => {
    assert.match(mob, /Mobil uyumlu web paneli|Mobil Uyumlu Web Paneli/i);
  });

  it("heading mentions her ekran", () => {
    assert.match(mob, /her ekran/i);
  });
});

// ─── Pricing section ─────────────────────────────────────────────────────────

describe("PricingSection — plan display", () => {
  const pricing = src("components/marketing/pricing-section.tsx");

  it("renders plans.map for each plan", () => {
    assert.match(pricing, /plans\.map/);
  });

  it("shows isFeatured badge for featured plans", () => {
    assert.match(pricing, /isFeatured/);
  });

  it("shows fallback when plans array is empty", () => {
    assert.match(pricing, /plans\.length.*0|plans\.length === 0/);
    assert.match(pricing, /İletişime Geçin|iletişime geçin/);
  });

  it("formats price with Intl.NumberFormat in TRY", () => {
    assert.match(pricing, /Intl\.NumberFormat/);
    assert.match(pricing, /tr-TR/);
  });

  it("shows register link when registrationEnabled", () => {
    assert.match(pricing, /\/register/);
  });

  it("has id=fiyatlar anchor", () => {
    assert.match(pricing, /id="fiyatlar"/);
  });
});

// ─── FAQ section ──────────────────────────────────────────────────────────────

describe("FaqSection — accessible accordion", () => {
  const faq = src("components/marketing/faq-section.tsx");

  it("has id=sss anchor", () => {
    assert.match(faq, /id="sss"/);
  });

  it("uses aria-expanded for accessibility", () => {
    assert.match(faq, /aria-expanded/);
  });

  it("does not claim SLA guarantee", () => {
    assert.doesNotMatch(faq, /SLA garanti|uptime garanti/i);
  });

  it("does not claim KVKK mevzuat uyumu certified", () => {
    assert.doesNotMatch(faq, /mevzuata uygun|mevzuat uyum/i);
  });

  it("mentions ödeme bilgisi gerektirmez", () => {
    assert.match(faq, /kredi kartı|ödeme bilgisi.*gerek/i);
  });

  it("mentions mobile support (responsive web)", () => {
    assert.match(faq, /responsive|tarayıcı.*kullan/i);
  });
});

// ─── Final CTA section ────────────────────────────────────────────────────────

describe("FinalCtaSection — CTA logic", () => {
  const cta = src("components/marketing/final-cta-section.tsx");

  it("has register link", () => {
    assert.match(cta, /\/register/);
  });

  it("has login fallback", () => {
    assert.match(cta, /\/login/);
  });

  it("respects registrationEnabled", () => {
    assert.match(cta, /registrationEnabled/);
  });

  it("has trialDays conditional", () => {
    assert.match(cta, /trialDays > 0/);
  });

  it("has Paketleri İncele secondary button", () => {
    assert.match(cta, /Paketleri İncele/);
  });
});

// ─── Footer ───────────────────────────────────────────────────────────────────

describe("MarketingFooter — real routes only", () => {
  const footer = src("components/marketing/marketing-footer.tsx");

  it("id=iletisim artık footer'da değil, ayrı ContactSection'da (gerçek iletişim formu için taşındı)", () => {
    assert.doesNotMatch(footer, /id="iletisim"/);
    assert.match(src("components/marketing/contact-section.tsx"), /id="iletisim"/);
  });

  it("links to /kvkk-aydinlatma-metni", () => {
    assert.match(footer, /\/kvkk-aydinlatma-metni/);
  });

  it("links to /kvkk", () => {
    assert.match(footer, /\/kvkk/);
  });

  it("links to /login", () => {
    assert.match(footer, /\/login/);
  });

  it("links to /register", () => {
    assert.match(footer, /\/register/);
  });

  it("uses supportEmail as mailto", () => {
    assert.match(footer, /mailto.*supportEmail|supportEmail.*mailto/);
  });

  it("uses supportPhone as tel", () => {
    assert.match(footer, /supportPhone/);
    assert.match(footer, /tel:/);
  });

  it("does not claim KVKK Uyumlu", () => {
    assert.doesNotMatch(footer, /KVKK Uyumlu/);
  });

  it("uses veri gizliliği odaklı phrasing", () => {
    assert.match(footer, /Veri gizliliği odaklı/i);
  });
});

// ─── PlatformSettings brand integration ──────────────────────────────────────

describe("PlatformSettings — brand integration", () => {
  const page = src("app/page.tsx");

  it("uses getPlatformSettings with fallback", () => {
    assert.match(page, /getPlatformSettings/);
    assert.match(page, /getPlatformSettingsFallback/);
  });

  it("passes brandName to HeroSection", () => {
    assert.match(page, /brandName.*settings\.brandName|settings\.brandName.*brandName/);
  });

  it("passes supportEmail to footer", () => {
    assert.match(page, /MarketingFooter[\s\S]*supportEmail/);
  });

  it("passes registrationEnabled to header, hero, pricing, and CTA", () => {
    const count = (page.match(/registrationEnabled/g) ?? []).length;
    assert.ok(count >= 4, `Expected ≥4 registrationEnabled uses, got ${count}`);
  });
});

// ─── Public security ──────────────────────────────────────────────────────────

describe("Marketing components — no secret or credential exposure", () => {
  const files = [
    "app/page.tsx",
    "components/marketing/marketing-header.tsx",
    "components/marketing/hero-section.tsx",
    "components/marketing/pricing-section.tsx",
    "components/marketing/marketing-footer.tsx",
  ];

  for (const file of files) {
    it(`${file} has no raw SECRET env references`, () => {
      const content = src(file);
      assert.doesNotMatch(
        content,
        /process\.env\.NEXTAUTH_SECRET|process\.env\.SUBSCRIPTION_PREVIEW_SECRET/
      );
    });

    it(`${file} has no hardcoded demo passwords`, () => {
      const content = src(file);
      assert.doesNotMatch(content, /password.*123|123.*password/i);
    });
  }
});

describe("Public security — no admin metadata in page", () => {
  const page = src("app/page.tsx");

  it("does not pass sessionMaxAgeDays to any component", () => {
    assert.doesNotMatch(page, /sessionMaxAgeDays/);
  });

  it("does not pass trialAmount to any component", () => {
    assert.doesNotMatch(page, /trialAmount/);
  });

  it("does not pass maxImageBytes to any component", () => {
    assert.doesNotMatch(page, /maxImageBytes/);
  });

  it("JSON-LD schemas contain no secret references", () => {
    assert.doesNotMatch(page, /process\.env/);
  });

  it("SoftwareApplication schema has no fake price offer", () => {
    assert.doesNotMatch(page, /price:\s*"0"|priceCurrency/);
  });

  it("public-plan-service does not select admin-only plan fields", () => {
    const service = src("lib/marketing/public-plan-service.ts");
    assert.doesNotMatch(service, /lockedPlanPriceId|paymentProvider|internalNote/);
  });
});

// ─── public-plan-service ──────────────────────────────────────────────────────

describe("public-plan-service — query safety", () => {
  const service = src("lib/marketing/public-plan-service.ts");

  it("filters by planStatus ACTIVE", () => {
    assert.match(service, /planStatus.*ACTIVE|ACTIVE.*planStatus/);
  });

  it("filters by visibility PUBLIC", () => {
    assert.match(service, /visibility.*PUBLIC|PUBLIC.*visibility/);
  });

  it("returns empty array on error", () => {
    assert.match(service, /catch/);
    assert.match(service, /return \[\]/);
  });

  it("converts Decimal prices to Number", () => {
    assert.match(service, /Number\(p\.monthlyPrice\)/);
    assert.match(service, /Number\(p\.yearlyPrice\)/);
  });
});

// ─── Maintenance mode ─────────────────────────────────────────────────────────

describe("Homepage — maintenance mode", () => {
  const page = src("app/page.tsx");

  it("redirects to /maintenance when maintenanceMode is true", () => {
    assert.match(page, /maintenanceMode/);
    assert.match(page, /redirect.*\/maintenance|\/maintenance.*redirect/);
  });
});

// ─── Link safety — routes exist ───────────────────────────────────────────────

describe("Link safety — linked routes must exist", () => {
  const ROUTE_DIRS = [
    ["register",                "app/register"],
    ["login",                   "app/login"],
    ["kvkk",                    "app/kvkk"],
    ["kvkk-aydinlatma-metni",   "app/kvkk-aydinlatma-metni"],
    ["maintenance",             "app/maintenance"],
  ] as const;

  for (const [route, dir] of ROUTE_DIRS) {
    it(`route /${route} directory exists`, () => {
      assert.ok(existsSync(join(webRoot, dir)), `Missing directory: ${dir}`);
    });
  }
});

// ─── Removed files ────────────────────────────────────────────────────────────

describe("Removed components — files should not exist", () => {
  it("trust-section.tsx is removed", () => {
    assert.ok(
      !existsSync(join(webRoot, "components/marketing/trust-section.tsx")),
      "trust-section.tsx should have been deleted"
    );
  });

  it("features-section.tsx is removed", () => {
    assert.ok(
      !existsSync(join(webRoot, "components/marketing/features-section.tsx")),
      "features-section.tsx should have been deleted"
    );
  });

  it("product-showcase-section.tsx is removed", () => {
    assert.ok(
      !existsSync(join(webRoot, "components/marketing/product-showcase-section.tsx")),
      "product-showcase-section.tsx should have been deleted"
    );
  });

  it("how-it-works-section.tsx is removed", () => {
    assert.ok(
      !existsSync(join(webRoot, "components/marketing/how-it-works-section.tsx")),
      "how-it-works-section.tsx should have been deleted"
    );
  });
});
