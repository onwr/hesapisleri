"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  Filter,
  Loader2,
  Pencil,
  Target,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { ActionCard } from "@/components/cards/action-card";
import { StatCard } from "@/components/cards/stat-card";
import {
  PerformanceTargetModal,
  type PerformanceTargetListItem,
} from "@/components/reports/performance-target-modal";
import { TeamActionButton } from "@/components/team/team-action-button";
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

const SCOPE_BADGE_CLASS = {
  employee: "bg-blue-50 text-blue-700",
  department: "bg-violet-50 text-violet-700",
  company: "bg-emerald-50 text-emerald-700",
} as const;

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

  const scopeCounts = useMemo(
    () => ({
      employee: targets.filter((item) => item.scope === "employee").length,
      department: targets.filter((item) => item.scope === "department").length,
      company: targets.filter((item) => item.scope === "company").length,
    }),
    [targets]
  );

  const hasFilters = Boolean(scope || department || employeeId);

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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {canManageTargets ? (
          <TeamActionButton
            title="Yeni Hedef"
            description="Performans hedefi oluştur"
            onClick={openCreateModal}
            icon={<Target size={22} strokeWidth={2.4} />}
            gradient="bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a]"
          />
        ) : null}

        <ActionCard
          title="Personel Performansı"
          description="Performans raporuna dön"
          href="/reports/personnel-performance"
          icon={<Users size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-blue-500 to-blue-600"
        />

        <ActionCard
          title="Departman Performansı"
          description="Departman kırılımını gör"
          href="/reports/personnel-performance/departments"
          icon={<Building2 size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-violet-500 to-purple-600"
        />

        <ActionCard
          title="Çalışanlar"
          description="Personel listesine git"
          href="/team"
          icon={<User size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-emerald-500 to-green-600"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Toplam Hedef"
          value={formatNumber(targets.length)}
          subtitle="Seçili dönemdeki kayıtlar"
          icon={<Target size={18} />}
          color="blue"
        />
        <StatCard
          title="Çalışan Hedefi"
          value={formatNumber(scopeCounts.employee)}
          subtitle="Bireysel hedefler"
          icon={<User size={18} />}
          color="green"
        />
        <StatCard
          title="Departman Hedefi"
          value={formatNumber(scopeCounts.department)}
          subtitle="Departman bazlı hedefler"
          icon={<Building2 size={18} />}
          color="purple"
        />
        <StatCard
          title="Firma Geneli"
          value={formatNumber(scopeCounts.company)}
          subtitle="Genel şirket hedefleri"
          icon={<Users size={18} />}
          color="orange"
        />
      </section>

      {isReadOnlyViewer ? (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Salt okunur görünüm: hedefleri görüntüleyebilirsiniz; oluşturma ve
          düzenleme yalnızca yöneticiler içindir.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-black text-[#0f1f4d]">
                  Performans Hedefleri
                </h2>
                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  {formatNumber(targets.length)} hedef listeleniyor
                </p>
              </div>

              {canManageTargets ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f]"
                >
                  <Target size={14} />
                  Yeni Hedef
                </button>
              ) : null}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void loadTargets();
              }}
              className="flex w-full flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end"
            >
              <FilterField label="Başlangıç">
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-10 w-full min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </FilterField>

              <FilterField label="Bitiş">
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-10 w-full min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </FilterField>

              <FilterField label="Hedef tipi">
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                  className="h-10 w-full min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
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
                  onChange={(event) => setDepartment(event.target.value)}
                  className="h-10 w-full min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
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
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className="h-10 w-full min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
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
                type="submit"
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <Filter size={14} />
                Filtrele
              </button>
            </form>
          </div>

          {targets.length === 0 ? (
            <TargetsEmptyState
              hasFilters={hasFilters}
              canManageTargets={canManageTargets}
              onCreate={openCreateModal}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1100px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-4 py-3">Hedef Tipi</th>
                      <th className="px-4 py-3">Kapsam</th>
                      <th className="px-4 py-3">Dönem</th>
                      <th className="px-4 py-3">Ciro Hedefi</th>
                      <th className="px-4 py-3">Satış Hedefi</th>
                      <th className="px-4 py-3">Tahsilat</th>
                      <th className="px-4 py-3">Skor</th>
                      <th className="px-4 py-3">Maks. İzin</th>
                      <th className="px-4 py-3 text-center">İşlem</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {targets.map((target) => (
                      <tr
                        key={target.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={[
                              "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
                              SCOPE_BADGE_CLASS[target.scope],
                            ].join(" ")}
                          >
                            {SCOPE_LABELS[target.scope]}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-extrabold text-[#0f1f4d]">
                          {getTargetSubject(target)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-500">
                          {formatDate(target.periodStart)} –{" "}
                          {formatDate(target.periodEnd)}
                        </td>

                        <td className="px-4 py-3">
                          {target.revenueTarget != null
                            ? formatMoney(target.revenueTarget)
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          {target.salesCountTarget != null
                            ? formatNumber(target.salesCountTarget)
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          {target.collectionTarget != null
                            ? formatMoney(target.collectionTarget)
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          {target.scoreTarget != null
                            ? formatNumber(target.scoreTarget)
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          {target.maxLeaveDays != null
                            ? formatNumber(target.maxLeaveDays)
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          {canManageTargets ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(target)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                                title="Düzenle"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === target.id}
                                onClick={() => handleDelete(target)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                title="Sil"
                              >
                                {deletingId === target.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="block text-center text-slate-400">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 border-t border-slate-100 p-4 lg:hidden">
                {targets.map((target) => (
                  <article
                    key={target.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span
                          className={[
                            "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
                            SCOPE_BADGE_CLASS[target.scope],
                          ].join(" ")}
                        >
                          {SCOPE_LABELS[target.scope]}
                        </span>
                        <p className="mt-2 truncate text-[14px] font-extrabold text-[#0f1f4d]">
                          {getTargetSubject(target)}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          {formatDate(target.periodStart)} –{" "}
                          {formatDate(target.periodEnd)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                      <span>
                        Ciro:{" "}
                        {target.revenueTarget != null
                          ? formatMoney(target.revenueTarget)
                          : "—"}
                      </span>
                      <span>
                        Satış:{" "}
                        {target.salesCountTarget != null
                          ? formatNumber(target.salesCountTarget)
                          : "—"}
                      </span>
                      <span>
                        Skor:{" "}
                        {target.scoreTarget != null
                          ? formatNumber(target.scoreTarget)
                          : "—"}
                      </span>
                      <span>
                        İzin:{" "}
                        {target.maxLeaveDays != null
                          ? formatNumber(target.maxLeaveDays)
                          : "—"}
                      </span>
                    </div>

                    {canManageTargets ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(target)}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-[11px] font-black text-[#0f1f4d]"
                        >
                          <Pencil size={13} />
                          Düzenle
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === target.id}
                          onClick={() => handleDelete(target)}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-red-100 bg-white px-4 text-[11px] font-black text-red-600 disabled:opacity-50"
                        >
                          Sil
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-[12px] font-extrabold text-[#24345f]/80">
              Hedef Dağılımı
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {formatPeriodLabel(from)} – {formatPeriodLabel(to)}
            </p>

            <div className="mt-4 space-y-3">
              <SummaryRow
                label="Toplam hedef"
                value={formatNumber(targets.length)}
                tone="blue"
              />
              <SummaryRow
                label="Çalışan"
                value={formatNumber(scopeCounts.employee)}
              />
              <SummaryRow
                label="Departman"
                value={formatNumber(scopeCounts.department)}
                tone="violet"
              />
              <SummaryRow
                label="Firma geneli"
                value={formatNumber(scopeCounts.company)}
                tone="emerald"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a] p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]">
            <p className="text-[13px] font-black">Hedef Yönetimi</p>
            <p className="mt-2 text-[12px] leading-6 text-white/80">
              Çalışan, departman veya firma geneli için dönemsel ciro, satış ve
              skor hedefleri tanımlayın.
            </p>
            {canManageTargets ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-[12px] font-black text-[#0f1f4d]"
              >
                Yeni Hedef Ekle
              </button>
            ) : (
              <Link
                href="/reports/personnel-performance"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-[12px] font-black text-[#0f1f4d]"
              >
                Performans Raporu
              </Link>
            )}
          </div>
        </aside>
      </div>

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

function TargetsEmptyState({
  hasFilters,
  canManageTargets,
  onCreate,
}: {
  hasFilters: boolean;
  canManageTargets: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-50 text-violet-600">
          <Target size={28} />
        </div>

        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
          {hasFilters
            ? "Seçilen filtreler için hedef bulunamadı"
            : "Henüz performans hedefi yok"}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {hasFilters
            ? "Filtre kriterlerinizi değiştirerek tekrar deneyin."
            : "İlk hedefinizi oluşturarak performans takibine başlayın."}
        </p>

        {canManageTargets ? (
          <button
            type="button"
            onClick={onCreate}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
          >
            İlk Hedefi Oluştur
          </button>
        ) : (
          <Link
            href="/reports/personnel-performance"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
          >
            Performans Raporu
          </Link>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "violet" | "emerald";
}) {
  const valueClass =
    tone === "blue"
      ? "text-blue-600"
      : tone === "violet"
        ? "text-violet-600"
        : tone === "emerald"
          ? "text-emerald-600"
          : "text-[#0f1f4d]";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className={["text-[13px] font-black", valueClass].join(" ")}>
        {value}
      </span>
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
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeriodLabel(value: string) {
  return formatDate(value);
}
