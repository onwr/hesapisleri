"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronRight,
  MoreHorizontal,
  ScanBarcode,
} from "lucide-react";
import { EmployeeActionsModal } from "@/components/employees/employee-actions-modal";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import { TEAM_LIST_ROW_CLASS } from "@/components/team/team-ui-tokens";
import {
  formatEmployeeLedgerSummary,
  formatEmployeePaymentSummary,
  formatEmployeePerformanceSummary,
  formatEmployeeSalarySummary,
} from "@/lib/employee-page-utils";
import { getEmployeeLedgerBalanceTone } from "@/lib/employee-ledger-utils";
import { getEmployeeStatusBadgeClass } from "@/lib/employee-utils";
import type { SerializedEmployee } from "@/lib/employee-page-types";

type EmployeeListRowProps = {
  employee: SerializedEmployee;
  canManage: boolean;
  saving: boolean;
  onPassivate: (employeeId: string) => void;
  onActivate: (employeeId: string) => void;
  onDelete: (employeeId: string) => void;
  onAddPayment: (employee: SerializedEmployee) => void;
  onAddLeave: (employee: SerializedEmployee) => void;
  onEdit: (employee: SerializedEmployee) => void;
  onManagePos: (employee: SerializedEmployee) => void;
};

export function EmployeeListRow({
  employee,
  canManage,
  saving,
  onPassivate,
  onActivate,
  onDelete,
  onAddPayment,
  onAddLeave,
  onEdit,
  onManagePos,
}: EmployeeListRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const posBadge = employee.hasPosAccess ? (
    employee.posAccount?.status === "ACTIVE" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
        <ScanBarcode size={11} />
        POS erişimi var
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
        <ScanBarcode size={11} />
        POS pasif
      </span>
    )
  ) : null;

  return (
    <>
      <article className={TEAM_LIST_ROW_CLASS}>
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <Link href={`/team/${employee.id}`} className="shrink-0">
            <EmployeeAvatar
              name={employee.fullName}
              avatarUrl={employee.avatarUrl}
              size="list"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/team/${employee.id}`}
              className="truncate text-[15px] font-extrabold text-[#0f1f4d] hover:underline"
            >
              {employee.fullName}
            </Link>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-500">
              {[employee.jobTitle, employee.department].filter(Boolean).join(" · ") ||
                "Görev ve departman belirtilmemiş"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
                  getEmployeeStatusBadgeClass(employee.status),
                ].join(" ")}
              >
                {employee.statusLabel}
              </span>
              {posBadge}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500 sm:hidden">
              <span>{employee.phone ?? "Telefon yok"}</span>
              <span>{employee.email ?? "E-posta yok"}</span>
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 flex-col gap-1 text-[12px] font-semibold text-slate-600 sm:flex md:min-w-[140px]">
          <span>{employee.phone ?? "—"}</span>
          <span className="truncate text-[11px] text-slate-400">
            {employee.email ?? "—"}
          </span>
        </div>

        <div className="flex shrink-0 flex-col gap-1 text-[12px] font-bold text-[#0f1f4d] sm:min-w-[150px]">
          <span>Net {formatEmployeeSalarySummary(employee)}</span>
          <span
            className={[
              "text-[11px] font-semibold",
              getEmployeeLedgerBalanceTone(employee.currentBalance ?? 0) ===
              "debt"
                ? "text-emerald-600"
                : getEmployeeLedgerBalanceTone(employee.currentBalance ?? 0) ===
                    "credit"
                  ? "text-amber-600"
                  : "text-slate-500",
            ].join(" ")}
          >
            Cari {formatEmployeeLedgerSummary(employee)}
          </span>
        </div>

        <div className="hidden shrink-0 flex-col gap-1 text-[12px] font-bold text-[#0f1f4d] md:flex md:min-w-[130px]">
          <span>{formatEmployeePerformanceSummary(employee)}</span>
          <span className="text-[11px] font-semibold text-slate-500">
            {formatEmployeePaymentSummary(employee)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
          <Link
            href={`/team/${employee.id}`}
            className="inline-flex h-10 items-center gap-1 rounded-2xl border border-slate-200/80 bg-white px-3 text-xs font-black text-[#0f1f4d] transition hover:bg-slate-50"
          >
            Detay
            <ChevronRight size={14} />
          </Link>

          {canManage ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-[#0f1f4d] transition hover:bg-slate-50 disabled:opacity-50"
              aria-label="Daha fazla işlem"
            >
              <MoreHorizontal size={16} />
            </button>
          ) : null}
        </div>
      </article>

      {canManage ? (
        <EmployeeActionsModal
          open={menuOpen}
          employee={employee}
          saving={saving}
          onClose={() => setMenuOpen(false)}
          onEdit={() => onEdit(employee)}
          onAddLeave={() => onAddLeave(employee)}
          onAddPayment={() => onAddPayment(employee)}
          onManagePos={() => onManagePos(employee)}
          onPassivate={() => onPassivate(employee.id)}
          onActivate={() => onActivate(employee.id)}
          onDelete={() => onDelete(employee.id)}
        />
      ) : null}
    </>
  );
}
