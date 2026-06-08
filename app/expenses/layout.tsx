import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="expenses">{children}</ModuleGuardLayout>;
}
