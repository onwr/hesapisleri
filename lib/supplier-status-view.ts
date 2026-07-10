import {
  resolveSupplierBalanceView,
  type SupplierBalanceDirection,
} from "@/lib/supplier-balance-utils";

export type SupplierOperationalStatus = "ACTIVE" | "PASSIVE";
export type SupplierAccountStatus = SupplierBalanceDirection;

export type SupplierStatusView = {
  operationalStatus: SupplierOperationalStatus;
  accountStatus: SupplierAccountStatus;
  isArchived: boolean;
  operationalLabel: string;
  accountLabel: string;
  displayStatus: SupplierOperationalStatus;
  displayLabel: string;
  operationalBadgeClass: string;
  accountBadgeClass: string;
};

const OPERATIONAL_BADGE: Record<SupplierOperationalStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PASSIVE: "bg-slate-100 text-slate-600",
};

const ACCOUNT_BADGE: Record<SupplierAccountStatus, string> = {
  PAYABLE: "bg-rose-50 text-rose-700",
  RECEIVABLE: "bg-blue-50 text-blue-700",
  SETTLED: "bg-slate-50 text-slate-600",
};

export function buildSupplierStatusView(input: {
  isActive: boolean;
  signedBalance: number;
  isArchived?: boolean;
}): SupplierStatusView {
  const balanceView = resolveSupplierBalanceView(input.signedBalance);
  const operationalStatus: SupplierOperationalStatus = input.isActive
    ? "ACTIVE"
    : "PASSIVE";

  return {
    operationalStatus,
    accountStatus: balanceView.direction,
    isArchived: Boolean(input.isArchived),
    operationalLabel: input.isActive ? "Aktif" : "Pasif",
    accountLabel: balanceView.directionLabel,
    displayStatus: operationalStatus,
    displayLabel: input.isActive ? "Aktif" : "Pasif",
    operationalBadgeClass: OPERATIONAL_BADGE[operationalStatus],
    accountBadgeClass: ACCOUNT_BADGE[balanceView.direction],
  };
}

export function getSupplierOperationalBadge(isActive: boolean) {
  const view = buildSupplierStatusView({ isActive, signedBalance: 0 });
  return {
    label: view.operationalLabel,
    className: view.operationalBadgeClass,
  };
}

export function getSupplierAccountBadge(signedBalance: number) {
  const view = buildSupplierStatusView({ isActive: true, signedBalance });
  return {
    label: view.accountLabel,
    className: view.accountBadgeClass,
  };
}
