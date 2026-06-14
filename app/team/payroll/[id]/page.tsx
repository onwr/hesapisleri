import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PayrollDetailClient } from "@/components/payroll/payroll-detail-client";
import { getAppSession } from "@/lib/app-session";
import { getEmployeeModulePermissions } from "@/lib/employee-permission-utils";
import { getPayrollDetailPageData } from "@/lib/payroll-page-data";
import { PayrollServiceError } from "@/lib/payroll-service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PayrollDetailPage({ params }: Props) {
  const session = await getAppSession();
  const { id } = await params;

  try {
    const data = await getPayrollDetailPageData({
      companyId: session.company.id,
      payrollRunId: id,
    });

    const employeePermissions = getEmployeeModulePermissions(
      session.effectiveRole,
      session.companyUser.isOwner
    );

    return (
      <AppShell>
        <PayrollDetailClient
          initialRun={data.payrollRun}
          initialPeriodPayments={data.periodPayments}
          canManagePayroll={employeePermissions.canManagePayroll}
          canProcessPayments={employeePermissions.canProcessPayments}
        />
      </AppShell>
    );
  } catch (error) {
    if (error instanceof PayrollServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
