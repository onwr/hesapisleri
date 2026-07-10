export type TeamSummaryEmployee = {
  status: string;
  salaryAmount?: number;
  pendingPaymentCount?: number;
  pendingLeaveCount?: number;
};

export type CanonicalTeamSummary = {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  passiveEmployees: number;
  terminatedEmployees: number;
  pendingLeaves: number;
  pendingPayments: number;
  currentPayroll: number;
  salesThisMonthEmployeeCount: number;
  thisMonthSalesTotal: number;
  withUserAccountCount: number;
  withPosAccessCount: number;
  hasOperationalTeam: boolean;
  showEmptyTeamState: boolean;
};

const OPERATIONAL_STATUSES = new Set(["ACTIVE", "ON_LEAVE"]);

export function isOperationalEmployeeStatus(status: string) {
  return OPERATIONAL_STATUSES.has(status);
}

export function buildCanonicalTeamSummary(input: {
  employees: TeamSummaryEmployee[];
  salesThisMonthEmployeeCount?: number;
  thisMonthSalesTotal?: number;
  withUserAccountCount?: number;
  withPosAccessCount?: number;
}): CanonicalTeamSummary {
  const activeEmployees = input.employees.filter((e) => e.status === "ACTIVE");
  const onLeaveEmployees = input.employees.filter((e) => e.status === "ON_LEAVE");
  const passiveEmployees = input.employees.filter((e) => e.status === "PASSIVE");
  const terminatedEmployees = input.employees.filter(
    (e) => e.status === "TERMINATED"
  );
  const operationalEmployees = input.employees.filter((e) =>
    isOperationalEmployeeStatus(e.status)
  );

  const pendingLeaves = operationalEmployees.reduce(
    (sum, employee) => sum + (employee.pendingLeaveCount ?? 0),
    0
  );
  const pendingPayments = operationalEmployees.reduce(
    (sum, employee) => sum + (employee.pendingPaymentCount ?? 0),
    0
  );
  const currentPayroll = operationalEmployees.reduce((sum, employee) => {
    return sum + (employee.salaryAmount ?? 0);
  }, 0);

  const hasOperationalTeam = operationalEmployees.length > 0;

  return {
    totalEmployees: input.employees.length,
    activeEmployees: activeEmployees.length,
    onLeaveEmployees: onLeaveEmployees.length,
    passiveEmployees: passiveEmployees.length,
    terminatedEmployees: terminatedEmployees.length,
    pendingLeaves,
    pendingPayments,
    currentPayroll,
    salesThisMonthEmployeeCount: input.salesThisMonthEmployeeCount ?? 0,
    thisMonthSalesTotal: input.thisMonthSalesTotal ?? 0,
    withUserAccountCount: input.withUserAccountCount ?? 0,
    withPosAccessCount: input.withPosAccessCount ?? 0,
    hasOperationalTeam,
    showEmptyTeamState: input.employees.length === 0,
  };
}

export function toEmployeeStatsFromTeamSummary(
  summary: CanonicalTeamSummary
) {
  return {
    activeCount: summary.activeEmployees,
    onLeaveCount: summary.onLeaveEmployees,
    passiveCount: summary.passiveEmployees,
    terminatedCount: summary.terminatedEmployees,
    totalCount: summary.totalEmployees,
    monthlyPayable: summary.currentPayroll,
    pendingLeaveCount: summary.pendingLeaves,
    pendingPaymentCount: summary.pendingPayments,
    withUserAccountCount: summary.withUserAccountCount,
    withPosAccessCount: summary.withPosAccessCount,
    salesThisMonthEmployeeCount: summary.salesThisMonthEmployeeCount,
    thisMonthSalesTotal: summary.thisMonthSalesTotal,
  };
}
