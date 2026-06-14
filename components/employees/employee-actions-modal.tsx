"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { EmployeeAvatar } from "@/components/employees/employee-avatar";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import type { SerializedEmployee } from "@/lib/employee-page-types";

type EmployeeActionsModalProps = {
  open: boolean;
  employee: SerializedEmployee;
  saving?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddLeave: () => void;
  onAddPayment: () => void;
  onManagePos: () => void;
  onPassivate: () => void;
  onActivate: () => void;
  onDelete: () => void;
};

export function EmployeeActionsModal({
  open,
  employee,
  saving = false,
  onClose,
  onEdit,
  onAddLeave,
  onAddPayment,
  onManagePos,
  onPassivate,
  onActivate,
  onDelete,
}: EmployeeActionsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  function runAction(action: () => void) {
    onClose();
    action();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${employee.fullName} işlemleri`}
    >
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div
        className={[TEAM_CARD_CLASS, "relative z-10 w-full max-w-sm overflow-hidden"].join(
          " "
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeeAvatar
              name={employee.fullName}
              avatarUrl={employee.avatarUrl}
              size="list"
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold text-[#0f1f4d]">
                {employee.fullName}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Çalışan işlemleri
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100"
            aria-label="Modalı kapat"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1 p-2">
          <ActionButton
            label="Düzenle"
            disabled={saving}
            onClick={() => runAction(onEdit)}
          />
          <ActionButton
            label="İzin ekle"
            disabled={saving}
            onClick={() => runAction(onAddLeave)}
          />
          <ActionButton
            label="Ödeme ekle"
            disabled={saving}
            onClick={() => runAction(onAddPayment)}
          />
          <ActionButton
            label={
              employee.hasPosAccess ? "POS erişimini yönet" : "POS hesabı oluştur"
            }
            disabled={saving}
            onClick={() => runAction(onManagePos)}
          />

          {employee.status === "ACTIVE" || employee.status === "ON_LEAVE" ? (
            <>
              <div className="my-1 border-t border-slate-100" />
              <ActionButton
                label="Pasif yap"
                tone="danger"
                disabled={saving}
                onClick={() => runAction(onPassivate)}
              />
            </>
          ) : null}

          {employee.status === "PASSIVE" ? (
            <>
              <div className="my-1 border-t border-slate-100" />
              <ActionButton
                label="Aktif yap"
                disabled={saving}
                onClick={() => runAction(onActivate)}
              />
              <ActionButton
                label="Sil"
                tone="danger"
                disabled={saving}
                onClick={() => runAction(onDelete)}
              />
            </>
          ) : null}
        </div>

        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-11 w-full items-center rounded-xl px-3 text-left text-[13px] font-bold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" ? "text-red-600" : "text-[#0f1f4d]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
