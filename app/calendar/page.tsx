import { AppShell } from "@/components/layout/app-shell";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { guardPageModule } from "@/lib/module-access";

export default async function CalendarPage() {
  await guardPageModule("calendar");

  return (
    <AppShell>
      <CalendarShell mode="page" />
    </AppShell>
  );
}
