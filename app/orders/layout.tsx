import { ModuleGuardLayout } from "@/lib/guard-layout";
import { isMarketplaceFeatureEnabled } from "@/lib/features/marketplace-feature";
import { redirect } from "next/navigation";

export default async function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isMarketplaceFeatureEnabled()) {
    redirect("/dashboard");
  }

  return <ModuleGuardLayout module="orders">{children}</ModuleGuardLayout>;
}
