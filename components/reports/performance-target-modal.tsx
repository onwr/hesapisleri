"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";

export type PerformanceTargetListItem = {
  id: string;
  scope: "employee" | "department" | "company";
  employeeId: string | null;
  department: string | null;
  employeeName: string | null;
  periodStart: string;
  periodEnd: string;
  revenueTarget: number | null;
  salesCountTarget: number | null;
  collectionTarget: number | null;
  maxLeaveDays: number | null;
  scoreTarget: number | null;
  notes: string | null;
  updatedAt?: string;
};

type PerformanceTargetModalProps = {
  open: boolean;
  mode: "create" | "edit";
  saving: boolean;
  error: string;
  periodStart: string;
  periodEnd: string;
  departments: string[];
  employees: Array<{ id: string; name: string }>;
  initialTarget?: PerformanceTargetListItem | null;
  onClose: () => void;
  onSubmit: (payload: {
    mode: "create" | "edit";
    targetId?: string;
    scope: "employee" | "department" | "company";
    employeeId?: string;
    department?: string;
    periodStart: string;
    periodEnd: string;
    revenueTarget?: number;
    salesCountTarget?: number;
    collectionTarget?: number;
    maxLeaveDays?: number;
    scoreTarget?: number;
    notes?: string;
  }) => void;
};

function formatDateInput(value: string) {
  return value.slice(0, 10);
}

function formatOptionalNumber(value: number | null | undefined) {
  return value != null ? String(value) : "";
}

function parseNumericField(value: string, label: string) {
  if (!value.trim()) return { ok: true as const, value: undefined };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false as const, message: `${label} geçerli bir sayı olmalıdır.` };
  }
  return { ok: true as const, value: parsed };
}

export function PerformanceTargetModal({
  open,
  mode,
  saving,
  error,
  periodStart,
  periodEnd,
  departments,
  employees,
  initialTarget,
  onClose,
  onSubmit,
}: PerformanceTargetModalProps) {
  const [scope, setScope] = useState<"employee" | "department" | "company">(
    "employee"
  );
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [from, setFrom] = useState(periodStart);
  const [to, setTo] = useState(periodEnd);
  const [revenueTarget, setRevenueTarget] = useState("");
  const [salesCountTarget, setSalesCountTarget] = useState("");
  const [collectionTarget, setCollectionTarget] = useState("");
  const [maxLeaveDays, setMaxLeaveDays] = useState("");
  const [scoreTarget, setScoreTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState("");

  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;

    if (isEdit && initialTarget) {
      setScope(initialTarget.scope);
      setEmployeeId(initialTarget.employeeId ?? "");
      setDepartment(initialTarget.department ?? "");
      setFrom(formatDateInput(initialTarget.periodStart));
      setTo(formatDateInput(initialTarget.periodEnd));
      setRevenueTarget(formatOptionalNumber(initialTarget.revenueTarget));
      setSalesCountTarget(formatOptionalNumber(initialTarget.salesCountTarget));
      setCollectionTarget(formatOptionalNumber(initialTarget.collectionTarget));
      setMaxLeaveDays(formatOptionalNumber(initialTarget.maxLeaveDays));
      setScoreTarget(formatOptionalNumber(initialTarget.scoreTarget));
      setNotes(initialTarget.notes ?? "");
    } else {
      setScope("employee");
      setEmployeeId("");
      setDepartment("");
      setFrom(periodStart);
      setTo(periodEnd);
      setRevenueTarget("");
      setSalesCountTarget("");
      setCollectionTarget("");
      setMaxLeaveDays("");
      setScoreTarget("");
      setNotes("");
    }

    setValidationError("");
  }, [open, isEdit, initialTarget, periodStart, periodEnd]);

  if (!open) return null;

  function handleSubmit() {
    setValidationError("");

    if (!isEdit) {
      if (scope === "employee" && !employeeId) {
        setValidationError("Çalışan seçin.");
        return;
      }
      if (scope === "department" && !department) {
        setValidationError("Departman seçin.");
        return;
      }
      if (!from || !to) {
        setValidationError("Dönem başlangıç ve bitiş zorunludur.");
        return;
      }
    }

    const revenue = parseNumericField(revenueTarget, "Ciro hedefi");
    if (!revenue.ok) {
      setValidationError(revenue.message);
      return;
    }

    const sales = parseNumericField(salesCountTarget, "Satış adedi hedefi");
    if (!sales.ok) {
      setValidationError(sales.message);
      return;
    }

    const collection = parseNumericField(collectionTarget, "Tahsilat hedefi");
    if (!collection.ok) {
      setValidationError(collection.message);
      return;
    }

    const leave = parseNumericField(maxLeaveDays, "Maks. izin günü");
    if (!leave.ok) {
      setValidationError(leave.message);
      return;
    }

    const score = parseNumericField(scoreTarget, "Skor hedefi");
    if (!score.ok) {
      setValidationError(score.message);
      return;
    }

    if (score.value != null && score.value > 100) {
      setValidationError("Skor hedefi en fazla 100 olabilir.");
      return;
    }

    onSubmit({
      mode,
      targetId: initialTarget?.id,
      scope,
      employeeId: scope === "employee" ? employeeId : undefined,
      department: scope === "department" ? department : undefined,
      periodStart: from,
      periodEnd: to,
      revenueTarget: revenue.value,
      salesCountTarget: sales.value,
      collectionTarget: collection.value,
      maxLeaveDays: leave.value,
      scoreTarget: score.value,
      notes,
    });
  }

  const displayError = validationError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={[TEAM_CARD_CLASS, "w-full max-w-xl space-y-4 p-6 shadow-xl"].join(" ")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-[#0f1f4d]">
              {isEdit ? "Hedefi düzenle" : "Performans hedefi"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {isEdit
                ? "Hedef değerlerini güncelleyin."
                : "Çalışan, departman veya firma geneli hedef tanımlayın."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { key: "employee" as const, label: "Çalışan" },
            { key: "department" as const, label: "Departman" },
            { key: "company" as const, label: "Firma geneli" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={isEdit}
              onClick={() => setScope(item.key)}
              className={[
                "rounded-xl px-3 py-2 text-xs font-black",
                scope === item.key
                  ? "bg-[#0f1f4d] text-white"
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
                isEdit ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {scope === "employee" ? (
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">Çalışan</span>
            <select
              value={employeeId}
              disabled={isEdit}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
            >
              <option value="">Seçin</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {scope === "department" ? (
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">Departman</span>
            <select
              value={department}
              disabled={isEdit}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
            >
              <option value="">Seçin</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Dönem başlangıç</span>
            <input
              type="date"
              value={from}
              disabled={isEdit}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Dönem bitiş</span>
            <input
              type="date"
              value={to}
              disabled={isEdit}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Ciro hedefi</span>
            <input
              type="number"
              min={0}
              value={revenueTarget}
              onChange={(e) => setRevenueTarget(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Satış adedi hedefi</span>
            <input
              type="number"
              min={0}
              value={salesCountTarget}
              onChange={(e) => setSalesCountTarget(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Tahsilat hedefi</span>
            <input
              type="number"
              min={0}
              value={collectionTarget}
              onChange={(e) => setCollectionTarget(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Skor hedefi</span>
            <input
              type="number"
              min={0}
              max={100}
              value={scoreTarget}
              onChange={(e) => setScoreTarget(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Maks. izin günü</span>
            <input
              type="number"
              min={0}
              value={maxLeaveDays}
              onChange={(e) => setMaxLeaveDays(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-500">Not</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        {displayError ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {displayError}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border px-4 text-xs font-black"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
