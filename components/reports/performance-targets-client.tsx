"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  PerformanceTargetModal,
  type PerformanceTargetListItem,
} from "@/components/reports/performance-target-modal";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { formatMoney, formatNumber } from "@/lib/format-utils";

type PerformanceTargetsClientProps = {
  initialTargets: PerformanceTargetListItem[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
  departments: string[];
  employees: Array<{ id: string; name: string }>;
  canManageTargets: boolean;
  isReadOnlyViewer?: boolean;
};

const SCOPE_LABELS = {
  employee: "Çalışan",
  department: "Departman",
  company: "Firma geneli",
} as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR");
}

export function PerformanceTargetsClient({
  initialTargets,
  defaultPeriodStart,
  defaultPeriodEnd,
  departments,
  employees,
  canManageTargets,
  isReadOnlyViewer = false,
}: PerformanceTargetsClientProps) {
  const [targets, setTargets] = useState(initialTargets);
  const [from, setFrom] = useState(defaultPeriodStart.slice(0, 10));
  const [to, setTo] = useState(defaultPeriodEnd.slice(0, 10));
  const [scope, setScope] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingTarget, setEditingTarget] = useState<PerformanceTargetListItem | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredCountLabel = useMemo(
    () => `${formatNumber(targets.length)} hedef`,
    [targets.length]
  );

  async function loadTargets() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (scope) params.set("scope", scope);
      if (department) params.set("department", department);
      if (employeeId) params.set("employeeId", employeeId);

      const res = await fetch(
        `/api/employees/performance-targets?${params.toString()}`
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Hedefler yüklenemedi.");
        return;
      }

      setTargets(json.targets);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setModalMode("create");
    setEditingTarget(null);
    setModalError("");
    setModalOpen(true);
  }

  function openEditModal(target: PerformanceTargetListItem) {
    setModalMode("edit");
    setEditingTarget(target);
    setModalError("");
    setModalOpen(true);
  }

  async function handleSubmit(payload: {
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
  }) {
    setSaving(true);
    setModalError("");
    try {
      if (payload.mode === "edit" && payload.targetId) {
        const res = await fetch(
          `/api/employees/performance-targets/${payload.targetId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revenueTarget: payload.revenueTarget,
              salesCountTarget: payload.salesCountTarget,
              collectionTarget: payload.collectionTarget,
              maxLeaveDays: payload.maxLeaveDays,
              scoreTarget: payload.scoreTarget,
              notes: payload.notes,
            }),
          }
        );
        const json = await res.json();
        if (!json.success) {
          setModalError(json.message ?? "Hedef güncellenemedi.");
          return;
        }
      } else {
        const res = await fetch("/api/employees/performance-targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: payload.scope === "employee" ? payload.employeeId : null,
            department: payload.scope === "department" ? payload.department : null,
            periodStart: payload.periodStart,
            periodEnd: payload.periodEnd,
            revenueTarget: payload.revenueTarget,
            salesCountTarget: payload.salesCountTarget,
            collectionTarget: payload.collectionTarget,
            maxLeaveDays: payload.maxLeaveDays,
            scoreTarget: payload.scoreTarget,
            notes: payload.notes,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setModalError(json.message ?? "Hedef kaydedilemedi.");
          return;
        }
      }

      setModalOpen(false);
      await loadTargets();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(target: PerformanceTargetListItem) {
    const scopeLabel = SCOPE_LABELS[target.scope];
    const subject =
      target.scope === "employee"
        ? target.employeeName
        : target.scope === "department"
          ? target.department
          : "Firma geneli";

    if (
      !window.confirm(
        `${scopeLabel} hedefini (${subject ?? "—"}) silmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    setDeletingId(target.id);
    setError("");
    try {
      const res = await fetch(`/api/employees/performance-targets/${target.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Hedef silinemedi.");
        return;
      }

      await loadTargets();
    } finally {
      setDeletingId(null);
    }
  }

  function getTargetSubject(target: PerformanceTargetListItem) {
    if (target.scope === "employee") return target.employeeName ?? "—";
    if (target.scope === "department") return target.department ?? "—";
    return "Firma geneli";
  }

  return (
    <div className="space-y-5">
      <Link
        href="/reports/personnel-performance"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#0f1f4d]"
      >
        <ArrowLeft size={16} />
        Personel performansına dön
      </Link>

      <section className={TEAM_CARD_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#0f1f4d]">Performans Hedefleri</h1>
            <p className="mt-2 text-sm text-slate-500">
              Çalışan, departman ve firma geneli hedefleri dönem bazlı yönetin.
            </p>
          </div>
          {canManageTargets ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white"
            >
              <Plus className="h-4 w-4" />
              Yeni Hedef
            </button>
          ) : null}
        </div>

        {isReadOnlyViewer ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            Salt okunur görünüm: hedefleri görüntüleyebilirsiniz; oluşturma ve
            düzenleme yalnızca yöneticiler içindir.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <FilterField label="Başlangıç">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </FilterField>
          <FilterField label="Bitiş">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </FilterField>
          <FilterField label="Hedef tipi">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">Tümü</option>
              <option value="employee">Çalışan</option>
              <option value="department">Departman</option>
              <option value="company">Firma geneli</option>
            </select>
          </FilterField>
          <FilterField label="Departman">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">Tümü</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Çalışan">
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-10 min-w-[180px] rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">Tümü</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FilterField>
          <button
            type="button"
            disabled={loading}
            onClick={loadTargets}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Filtrele
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <section className={[TEAM_CARD_CLASS, "overflow-x-auto"].join(" ")}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-500">{filteredCountLabel}</p>
        </div>
        <table className="min-w-[1200px] w-full text-left text-sm">
          <thead>
            <tr className="border-b text-[11px] font-black uppercase text-slate-400">
              <th className="py-2 pr-4">Hedef tipi</th>
              <th className="py-2 pr-4">Kapsam</th>
              <th className="py-2 pr-4">Dönem</th>
              <th className="py-2 pr-4">Ciro hedefi</th>
              <th className="py-2 pr-4">Satış hedefi</th>
              <th className="py-2 pr-4">Tahsilat hedefi</th>
              <th className="py-2 pr-4">Skor hedefi</th>
              <th className="py-2 pr-4">Maks. izin</th>
              <th className="py-2 pr-4">Güncelleme</th>
              <th className="py-2">Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            {targets.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  Seçilen filtreler için hedef bulunamadı.
                </td>
              </tr>
            ) : (
              targets.map((target) => (
                <tr key={target.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4 font-bold text-[#0f1f4d]">
                    {SCOPE_LABELS[target.scope]}
                  </td>
                  <td className="py-3 pr-4">{getTargetSubject(target)}</td>
                  <td className="py-3 pr-4">
                    {formatDate(target.periodStart)} – {formatDate(target.periodEnd)}
                  </td>
                  <td className="py-3 pr-4">
                    {target.revenueTarget != null
                      ? formatMoney(target.revenueTarget)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {target.salesCountTarget != null
                      ? formatNumber(target.salesCountTarget)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {target.collectionTarget != null
                      ? formatMoney(target.collectionTarget)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {target.scoreTarget != null ? formatNumber(target.scoreTarget) : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {target.maxLeaveDays != null
                      ? formatNumber(target.maxLeaveDays)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {target.updatedAt
                      ? new Date(target.updatedAt).toLocaleString("tr-TR")
                      : "—"}
                  </td>
                  <td className="py-3">
                    {canManageTargets ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(target)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-black text-[#0f1f4d]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Düzenle
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === target.id}
                          onClick={() => handleDelete(target)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-100 px-2 text-[11px] font-black text-red-600 disabled:opacity-50"
                        >
                          {deletingId === target.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Sil
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {canManageTargets ? (
        <PerformanceTargetModal
        open={modalOpen}
        mode={modalMode}
        saving={saving}
        error={modalError}
        periodStart={from}
        periodEnd={to}
        departments={departments}
        employees={employees}
        initialTarget={editingTarget}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}
