import { AppShell } from "@/components/layout/app-shell";
import { PersonnelPerformanceClient } from "@/components/reports/personnel-performance-client";
import { getPersonnelPerformanceReport } from "@/lib/employee-performance-service";
import {
  getPersonnelPerformanceFilterOptions,
  requirePersonnelPerformanceAccess,
} from "@/lib/personnel-performance-page-data";
import { getEmployeeModulePermissions } from "@/lib/employee-permission-utils";

export default async function PersonnelPerformanceReportPage() {
  const session = await requirePersonnelPerformanceAccess();

  const [report, filterOptions] = await Promise.all([
    getPersonnelPerformanceReport({ companyId: session.company.id }),
    getPersonnelPerformanceFilterOptions(session.company.id),
  ]);

  const employeePermissions = getEmployeeModulePermissions(
    session.effectiveRole,
    session.companyUser.isOwner
  );

  return (
    <AppShell>
      <PersonnelPerformanceClient
        initialReport={report}
        departments={filterOptions.departments}
        employees={filterOptions.employees}
        canManageTargets={employeePermissions.canManageTargets}
      />
    </AppShell>
  );
}
