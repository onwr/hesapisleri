import { AppShell } from "@/components/layout/app-shell";
import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuardLayout module="admin">
      <AppShell>{children}</AppShell>
    </ModuleGuardLayout>
  );
}
