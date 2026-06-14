import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { EmployeeDetailClient } from "@/components/employees/employee-detail-client";
import { getAppSession } from "@/lib/app-session";
import { getEmployeeModulePermissions } from "@/lib/employee-permission-utils";
import { getEmployeeDetailPageData } from "@/lib/employee-page-data";
import { EmployeeServiceError } from "@/lib/employee-service";

type EmployeeDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: EmployeeDetailPageProps) {
  const session = await getAppSession();
  const { id } = await params;
  const query = await searchParams;

  try {
    const data = await getEmployeeDetailPageData({
      companyId: session.company.id,
      employeeId: id,
      includeSensitive: true,
    });

    const employeePermissions = getEmployeeModulePermissions(
      session.effectiveRole,
      session.companyUser.isOwner
    );

    return (
      <AppShell>
        <Suspense fallback={null}>
          <EmployeeDetailClient
            employee={data.employee}
            performance={data.performance}
            activities={data.activities}
            canManage={employeePermissions.canManageRecords}
            canProcessPayments={employeePermissions.canProcessPayments}
            initialTab={query.tab}
          />
        </Suspense>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof EmployeeServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
