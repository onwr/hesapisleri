import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { guardPageModule } from "@/lib/module-access";

function CalendarLoading() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
      Takvim yükleniyor...
    </div>
  );
}

export default async function CalendarPage() {
  await guardPageModule("calendar");

  return (
    <AppShell>
      <Suspense fallback={<CalendarLoading />}>
        <CalendarShell mode="page" />
      </Suspense>
    </AppShell>
  );
}
