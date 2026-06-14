"use client";

import { UserPlus } from "lucide-react";
import { EmployeeListRow } from "@/components/employees/employee-list-row";
import { TEAM_EMPTY_STATE_CLASS } from "@/components/team/team-ui-tokens";
import type { SerializedEmployee } from "@/lib/employee-page-types";
import type { EmployeeTabKey } from "@/lib/employee-utils";

type EmployeeTableProps = {
  rows: SerializedEmployee[];
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

export function EmployeeTable({
  rows,
  canManage,
  saving,
  onPassivate,
  onActivate,
  onDelete,
  onAddPayment,
  onAddLeave,
  onEdit,
  onManagePos,
}: EmployeeTableProps) {
  return (
    <div className="space-y-3 p-4 sm:p-5">
      {rows.map((employee) => (
        <EmployeeListRow
          key={employee.id}
          employee={employee}
          canManage={canManage}
          saving={saving}
          onPassivate={onPassivate}
          onActivate={onActivate}
          onDelete={onDelete}
          onAddPayment={onAddPayment}
          onAddLeave={onAddLeave}
          onEdit={onEdit}
          onManagePos={onManagePos}
        />
      ))}
    </div>
  );
}

export function EmployeeEmptyState({
  hasFilters,
  onClear,
  onCreate,
  canManage,
}: {
  tab?: EmployeeTabKey | string;
  hasFilters: boolean;
  onClear?: () => void;
  onCreate?: () => void;
  canManage: boolean;
}) {
  const message = hasFilters
    ? "Filtrelere uygun çalışan bulunamadı."
    : "Henüz çalışan eklenmedi.";

  const description = hasFilters
    ? "Farklı filtreler deneyebilir veya filtreleri temizleyebilirsiniz."
    : "İlk çalışan kaydınızı oluşturarak personel takibine başlayın.";

  return (
    <div className={[TEAM_EMPTY_STATE_CLASS, "mx-4 my-5 sm:mx-5"].join(" ")}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <UserPlus size={24} />
      </div>
      <p className="mt-4 text-[15px] font-extrabold text-[#0f1f4d]">{message}</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] font-medium text-slate-500">
        {description}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasFilters && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black text-[#0f1f4d]"
          >
            Filtreleri temizle
          </button>
        ) : null}
        {canManage && onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-2xl bg-[#0f1f4d] px-4 py-2 text-xs font-black text-white"
          >
            Çalışan Ekle
          </button>
        ) : null}
      </div>
    </div>
  );
}
