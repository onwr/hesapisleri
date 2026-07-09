"use client";

import { Loader2, MoreHorizontal, Pencil, Trash2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getEmployeePaymentRowActions } from "@/lib/employee-payment-row-actions";
import type { EmployeePaymentStatus } from "@prisma/client";

type EmployeePaymentRowActionsProps = {
  paymentId: string;
  paymentLabel: string;
  status: EmployeePaymentStatus;
  disabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function EmployeePaymentRowActions({
  paymentId,
  paymentLabel,
  status,
  disabled = false,
  onEdit,
  onCancel,
  onDelete,
}: EmployeePaymentRowActionsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const actions = getEmployeePaymentRowActions(status);

  const hasMenu = actions.edit || actions.cancel || actions.delete;
  if (!hasMenu) return <span className="text-slate-400">—</span>;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        aria-label={`${paymentLabel} işlemleri`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {disabled ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <MoreHorizontal size={14} />
        )}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-1 min-w-[168px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          {actions.edit ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              <Pencil size={14} />
              Düzenle
            </button>
          ) : null}
          {actions.cancel ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-amber-700 hover:bg-amber-50"
              onClick={() => {
                setOpen(false);
                onCancel();
              }}
            >
              <XCircle size={14} />
              İptal Et
            </button>
          ) : null}
          {actions.delete ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={14} />
              Sil
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
