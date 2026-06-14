import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { TeamPageClient } from "@/components/team/team-page-client";
import { getAppSession } from "@/lib/app-session";
import { getEmployeeModulePermissions } from "@/lib/employee-permission-utils";
import { getEmployeePageData } from "@/lib/employee-page-data";

type TeamPageProps = {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    department?: string;
    jobTitle?: string;
    status?: string;
    employmentType?: string;
    sort?: string;
  }>;
};

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const session = await getAppSession();
  const params = await searchParams;

  const employeePermissions = getEmployeeModulePermissions(
    session.effectiveRole,
    session.companyUser.isOwner
  );

  const data = await getEmployeePageData({
    companyId: session.company.id,
    tab: params.tab,
    q: params.q,
    department: params.department,
    jobTitle: params.jobTitle,
    status: params.status,
    employmentType: params.employmentType,
    sort: params.sort,
  });

  return (
    <AppShell>
      <TeamPageClient
        initialEmployees={data.employees}
        initialSummary={data.summary}
        employeePermissions={employeePermissions}
        initialTab={data.filters.tab}
        initialSearch={data.filters.search}
        initialDepartment={data.filters.department}
        initialJobTitle={data.filters.jobTitle}
        initialStatus={data.filters.status}
        initialEmploymentType={data.filters.employmentType}
        initialSort={data.filters.sort}
      />
    </AppShell>
  );
}
