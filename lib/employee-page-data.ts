import { listEmployees } from "@/lib/employee-service";
import {
  parseEmployeeDepartment,
  parseEmployeeJobTitle,
  parseEmployeeSearch,
  parseEmployeeSort,
  parseEmployeeStatusFilter,
  parseEmployeeTab,
} from "@/lib/employee-page-utils";

export async function getEmployeePageData(input: {
  companyId: string;
  tab?: string | null;
  q?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  status?: string | null;
  employmentType?: string | null;
  sort?: string | null;
}) {
  const tab = parseEmployeeTab(input.tab);
  const search = parseEmployeeSearch(input.q);
  const department = parseEmployeeDepartment(input.department);
  const jobTitle = parseEmployeeJobTitle(input.jobTitle);
  const status = parseEmployeeStatusFilter(input.status);
  const sort = parseEmployeeSort(input.sort);

  const employeePayload = await listEmployees({
    companyId: input.companyId,
    filters: {
      tab,
      search,
      department: department || undefined,
      employmentType: input.employmentType as never,
      sort,
    },
  });

  return {
    employees: employeePayload.employees,
    summary: employeePayload.summary,
    filters: {
      tab,
      search,
      department,
      jobTitle,
      status,
      employmentType: input.employmentType ?? "",
      sort,
    },
  };
}

export async function getEmployeeDetailPageData(input: {
  companyId: string;
  employeeId: string;
  includeSensitive?: boolean;
}) {
  const { getEmployeeById } = await import("@/lib/employee-service");
  return getEmployeeById({
    companyId: input.companyId,
    employeeId: input.employeeId,
    includeSensitive: input.includeSensitive,
  });
}
