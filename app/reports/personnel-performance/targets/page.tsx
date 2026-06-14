import { AppShell } from "@/components/layout/app-shell";
import { PerformanceTargetsClient } from "@/components/reports/performance-targets-client";
import { listPerformanceTargets } from "@/lib/employee-performance-target-service";
import { normalizePerformanceDateRange } from "@/lib/employee-performance-utils";
import { getEmployeeModulePermissions } from "@/lib/employee-permission-utils";
import {
  getPersonnelPerformanceFilterOptions,
  requirePersonnelPerformanceAccess,
} from "@/lib/personnel-performance-page-data";

export default async function PerformanceTargetsPage() {
  const session = await requirePersonnelPerformanceAccess();
  const rangeResult = normalizePerformanceDateRange({});

  if (!rangeResult.ok) {
    throw new Error(rangeResult.message);
  }

  const employeePermissions = getEmployeeModulePermissions(
    session.effectiveRole,
    session.companyUser.isOwner
  );

  const [targets, filterOptions] = await Promise.all([
    listPerformanceTargets({
      companyId: session.company.id,
      periodStart: rangeResult.from,
      periodEnd: rangeResult.to,
    }),
    getPersonnelPerformanceFilterOptions(session.company.id),
  ]);

  return (
    <AppShell>
      <PerformanceTargetsClient
        initialTargets={targets}
        defaultPeriodStart={rangeResult.from.toISOString()}
        defaultPeriodEnd={rangeResult.to.toISOString()}
        departments={filterOptions.departments}
        employees={filterOptions.employees}
        canManageTargets={employeePermissions.canManageTargets}
        isReadOnlyViewer={employeePermissions.isReadOnlyViewer}
      />
    </AppShell>
  );
}
