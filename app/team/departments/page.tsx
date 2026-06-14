import { AppShell } from "@/components/layout/app-shell";
import { TeamDepartmentsClient } from "@/components/team/team-departments-client";
import { getAppSession } from "@/lib/app-session";
import { getEmployeeModulePermissions } from "@/lib/employee-permission-utils";
import { guardPageModule } from "@/lib/module-access";

export default async function TeamDepartmentsPage() {
  await guardPageModule("employees");
  const session = await getAppSession();
  const employeePermissions = getEmployeeModulePermissions(
    session.effectiveRole,
    session.companyUser.isOwner
  );

  return (
    <AppShell>
      <TeamDepartmentsClient
        canManage={employeePermissions.canManageRecords}
      />
    </AppShell>
  );
}
