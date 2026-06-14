"use client";

import Link from "next/link";
import {
  CalendarClock,
  Mail,
  Phone,
  ScanBarcode,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import { TEAM_HERO_CLASS } from "@/components/team/team-ui-tokens";
import { formatEmployeeDate } from "@/lib/employee-page-utils";
import { getEmployeeStatusBadgeClass } from "@/lib/employee-utils";
import type { SerializedEmployee } from "@/lib/employee-page-types";

type EmployeeProfileHeaderProps = {
  employee: SerializedEmployee;
  canManage: boolean;
  saving: boolean;
  onEdit?: () => void;
  onAddPayment: () => void;
  onAddLeave: () => void;
  onManagePos: () => void;
  onPassivate: () => void;
  onActivate: () => void;
  onDelete: () => void;
};

export function EmployeeProfileHeader({
  employee,
  canManage,
  saving,
  onAddPayment,
  onAddLeave,
  onManagePos,
  onPassivate,
  onActivate,
  onDelete,
}: EmployeeProfileHeaderProps) {
  const posBadge = employee.hasPosAccess ? (
    employee.posAccount?.status === "ACTIVE" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">
        <ScanBarcode size={12} />
        POS erişimi var
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
        <ScanBarcode size={12} />
        POS pasif
      </span>
    )
  ) : null;

  return (
    <section className={TEAM_HERO_CLASS}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <EmployeeAvatar
            name={employee.fullName}
            avatarUrl={employee.avatarUrl}
            size="xl"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#0f1f4d] sm:text-[28px]">
              {employee.fullName}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {[employee.jobTitle, employee.department]
                .filter(Boolean)
                .join(" · ") || "Görev ve departman belirtilmemiş"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
            <div className="mt-4 grid gap-2 text-[13px] font-medium text-slate-600 sm:grid-cols-2">
              <span className="inline-flex items-center gap-2">
                <Phone size={14} className="text-slate-400" />
                {employee.phone ?? "Telefon yok"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Mail size={14} className="text-slate-400" />
                {employee.email ?? "E-posta yok"}
              </span>
              <span className="inline-flex items-center gap-2 sm:col-span-2">
                <CalendarClock size={14} className="text-slate-400" />
                İşe başlama: {formatEmployeeDate(employee.startDate)}
              </span>
            </div>
          </div>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAddPayment}
              className="rounded-2xl bg-[#0f1f4d] px-4 py-2 text-xs font-black text-white"
            >
              Ödeme Ekle
            </button>
            <button
              type="button"
              onClick={onAddLeave}
              className="rounded-2xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-black text-[#0f1f4d]"
            >
              İzin Ekle
            </button>
            <button
              type="button"
              onClick={onManagePos}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700"
            >
              POS Erişimi
            </button>
            {employee.status === "ACTIVE" || employee.status === "ON_LEAVE" ? (
              <button
                type="button"
                disabled={saving}
                onClick={onPassivate}
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-600 disabled:opacity-50"
              >
                Pasif Yap
              </button>
            ) : null}
            {employee.status === "PASSIVE" ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onActivate}
                  className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 disabled:opacity-50"
                >
                  Aktif Yap
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onDelete}
                  className="rounded-2xl border border-red-300 bg-red-100 px-4 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                >
                  Sil
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function EmployeeDetailBackLink() {
  return (
    <Link
      href="/team"
      className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#0f1f4d]"
    >
      ← Çalışanlar
    </Link>
  );
}
