import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuardLayout module="suppliers">{children}</ModuleGuardLayout>
  );
}
