import { ModuleGuardLayout } from "@/lib/guard-layout";
import { privateRouteMetadata } from "@/lib/route-seo";

export const metadata = privateRouteMetadata;

export default function CashBankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="cash-bank">{children}</ModuleGuardLayout>;
}
