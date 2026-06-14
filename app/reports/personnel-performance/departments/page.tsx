import { AppShell } from "@/components/layout/app-shell";
import { DepartmentPerformanceClient } from "@/components/reports/department-performance-client";
import { getDepartmentPerformanceReport } from "@/lib/reports/department-performance-report";
import { requirePersonnelPerformanceAccess } from "@/lib/personnel-performance-page-data";

export default async function DepartmentPerformancePage() {
  const session = await requirePersonnelPerformanceAccess();

  const report = await getDepartmentPerformanceReport({
    companyId: session.company.id,
  });

  return (
    <AppShell>
      <DepartmentPerformanceClient initialReport={report} />
    </AppShell>
  );
}
