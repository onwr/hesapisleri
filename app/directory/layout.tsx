import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function DirectoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuardLayout module="directory">{children}</ModuleGuardLayout>
  );
}
