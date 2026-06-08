import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function InvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="invoices">{children}</ModuleGuardLayout>;
}
