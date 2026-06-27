import { RegisterContent } from "@/components/register/register-content";
import { AuthShell } from "@/components/auth/auth-shell";
import { buildMarketingConsentText } from "@/lib/legal/kvkk-consent";
import { getPlatformLegalInfo } from "@/lib/legal/platform-legal-info";
import { getNewCompanyDefaults } from "@/lib/admin/platform-settings";
import { getPublicPlatformRuntimeConfig } from "@/lib/platform-runtime";
import { readPartnerAttributionFromCookies } from "@/lib/partner-auth";
import { resolvePublicReferralSignupInfo } from "@/lib/partner-service";

type RegisterPageProps = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const attribution = await readPartnerAttributionFromCookies();
  const referralCode = params.ref?.trim() || attribution.referralCode;

  const [legalInfo, runtime, companyDefaults, referral] = await Promise.all([
    getPlatformLegalInfo(),
    getPublicPlatformRuntimeConfig(),
    getNewCompanyDefaults(),
    referralCode ? resolvePublicReferralSignupInfo(referralCode) : Promise.resolve(null),
  ]);

  return (
    <AuthShell variant="register">
      <RegisterContent
        referral={referral}
        legalInfo={legalInfo}
        trialDays={companyDefaults.trialDays}
        marketingConsentText={buildMarketingConsentText(legalInfo.brandName)}
        registrationEnabled={runtime.registrationEnabled}
      />
    </AuthShell>
  );
}
