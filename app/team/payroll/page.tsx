import { AppShell } from "@/components/layout/app-shell";
import { PayrollPageClient } from "@/components/payroll/payroll-page-client";
import { getAppSession } from "@/lib/app-session";
import { getEmployeeModulePermissions } from "@/lib/employee-permission-utils";
import { getPayrollListPageData } from "@/lib/payroll-page-data";

export default async function PayrollPage() {
  const session = await getAppSession();
  const employeePermissions = getEmployeeModulePermissions(
    session.effectiveRole,
    session.companyUser.isOwner
  );
  const data = await getPayrollListPageData({
    companyId: session.company.id,
  });

  return (
    <AppShell>
      <PayrollPageClient
        initialRuns={data.payrollRuns}
        initialStats={data.stats}
        canManagePayroll={employeePermissions.canManagePayroll}
        isReadOnlyViewer={employeePermissions.isReadOnlyViewer}
      />
    </AppShell>
  );
}
