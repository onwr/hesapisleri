import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="pos">{children}</ModuleGuardLayout>;
}
