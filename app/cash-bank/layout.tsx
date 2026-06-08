import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function CashBankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="cash-bank">{children}</ModuleGuardLayout>;
}
