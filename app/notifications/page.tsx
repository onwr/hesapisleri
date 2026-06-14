import { AppShell } from "@/components/layout/app-shell";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationsPageClient />
    </AppShell>
  );
}
