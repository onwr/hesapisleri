import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuardLayout module="employees">{children}</ModuleGuardLayout>
  );
}
