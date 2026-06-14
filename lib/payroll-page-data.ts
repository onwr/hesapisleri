import {
  getPayrollDashboardStats,
  getPayrollRunDetail,
  getPayrollRunPeriodPayments,
  listPayrollRuns,
} from "@/lib/payroll-service";

export async function getPayrollListPageData(input: {
  companyId: string;
  status?: string;
  search?: string;
  page?: number;
}) {
  const [listResult, stats] = await Promise.all([
    listPayrollRuns({
      companyId: input.companyId,
      status: input.status as never,
      search: input.search,
      page: input.page,
    }),
    getPayrollDashboardStats(input.companyId),
  ]);

  return {
    payrollRuns: listResult.payrollRuns,
    pagination: listResult.pagination,
    stats,
  };
}

export async function getPayrollDetailPageData(input: {
  companyId: string;
  payrollRunId: string;
}) {
  const [payrollRun, periodPayments] = await Promise.all([
    getPayrollRunDetail({
      companyId: input.companyId,
      payrollRunId: input.payrollRunId,
    }),
    getPayrollRunPeriodPayments({
      companyId: input.companyId,
      payrollRunId: input.payrollRunId,
    }),
  ]);

  return { payrollRun, periodPayments };
}
