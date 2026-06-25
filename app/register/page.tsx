import { RegisterForm } from "@/components/register/register-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { readPartnerAttributionFromCookies } from "@/lib/partner-auth";
import { resolvePublicReferralSignupInfo } from "@/lib/partner-service";

type RegisterPageProps = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const attribution = await readPartnerAttributionFromCookies();
  const referralCode = params.ref?.trim() || attribution.referralCode;

  const referral = referralCode
    ? await resolvePublicReferralSignupInfo(referralCode)
    : null;

  return (
    <AuthShell variant="register">
      <RegisterForm referral={referral} />
    </AuthShell>
  );
}
