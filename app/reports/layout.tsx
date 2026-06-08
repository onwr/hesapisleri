import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="reports">{children}</ModuleGuardLayout>;
}
