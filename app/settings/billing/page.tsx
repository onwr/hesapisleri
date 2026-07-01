import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { MembershipBillingPanel } from "@/components/settings/membership-billing-panel";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { getBillingPaymentProvider } from "@/lib/payments/billing-provider-resolver";

export default async function SettingsBillingPage() {
  const session = await getAppSession();

  if (
    !canManageMembership(session.effectiveRole, session.companyUser.isOwner)
  ) {
    redirect("/unauthorized");
  }

  const checkoutProvider = getBillingPaymentProvider();

  return (
    <AppShell>
      <MembershipBillingPanel checkoutProvider={checkoutProvider} />
    </AppShell>
  );
}
