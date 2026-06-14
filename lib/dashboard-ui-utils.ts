export type DashboardStatLinks = {
  todaySales: string;
  monthSales: string;
  pendingCollection: string;
  monthExpenses: string;
  cashBank: string;
};

export const DEFAULT_DASHBOARD_STAT_LINKS: DashboardStatLinks = {
  todaySales: "/sales",
  monthSales: "/sales",
  pendingCollection: "/cash-bank/collections",
  monthExpenses: "/expenses",
  cashBank: "/cash-bank",
};

export function resolveDashboardStatLinks(
  links?: Partial<DashboardStatLinks> | null
): DashboardStatLinks {
  return {
    ...DEFAULT_DASHBOARD_STAT_LINKS,
    ...links,
  };
}
