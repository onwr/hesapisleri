import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MembershipBillingPanel } from "@/components/settings/membership-billing-panel";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { getBillingPaymentProvider } from "@/lib/payments/billing-provider-resolver";
import { readPartnerAttributionFromCookies } from "@/lib/partner-auth";
import { applyPartnerReferralToExistingCompany } from "@/lib/partner-conversion-service";
import { sanitizeReferralCode } from "@/lib/partner-utils";

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const session = await getAppSession();
  const params = await searchParams;

  if (
    !canManageMembership(session.effectiveRole, session.companyUser.isOwner)
  ) {
    redirect("/unauthorized");
  }

  const attribution = await readPartnerAttributionFromCookies();
  const referralCode =
    (params.ref ? sanitizeReferralCode(params.ref) : null) ??
    attribution.referralCode;

  if (referralCode) {
    await applyPartnerReferralToExistingCompany({
      companyId: session.company.id,
      userId: session.user.id,
      referralCode,
      clickId: attribution.clickId,
    }).catch((error) => {
      console.error("PARTNER_REFERRAL_BILLING_ATTRIBUTION_ERROR", error);
    });
  }

  const checkoutProvider = getBillingPaymentProvider();

  return (
    <AppShell>
      <MembershipBillingPanel checkoutProvider={checkoutProvider} />
    </AppShell>
  );
}
