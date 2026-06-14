import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleGuardLayout module="notifications">{children}</ModuleGuardLayout>
  );
}
