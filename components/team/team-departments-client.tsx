"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, Loader2, Plus } from "lucide-react";
import { StatCard } from "@/components/cards/stat-card";
import { TEAM_CARD_CLASS, TEAM_HERO_CLASS } from "@/components/team/team-ui-tokens";
import type { SerializedEmployeeDepartment } from "@/lib/employee-department-utils";

type DepartmentStats = {
  activeCount: number;
  passiveCount: number;
  unassignedEmployeeCount: number;
  busiestDepartment: { name: string; employeeCount: number } | null;
};

type EmployeeOption = {
  id: string;
  fullName: string;
};

type TeamDepartmentsClientProps = {
  canManage: boolean;
};

export function TeamDepartmentsClient({ canManage }: TeamDepartmentsClientProps) {
  const [departments, setDepartments] = useState<SerializedEmployeeDepartment[]>(
    []
  );
  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedEmployeeDepartment | null>(
    null
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [managerEmployeeId, setManagerEmployeeId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [deptRes, empRes] = await Promise.all([
        fetch("/api/employees/departments?includeInactive=true&stats=true"),
        fetch("/api/employees"),
      ]);
      const deptJson = await deptRes.json();
      const empJson = await empRes.json();

      if (!deptRes.ok || !deptJson.success) {
        setError(deptJson.message || "Departmanlar yüklenemedi.");
        return;
      }

      setDepartments(deptJson.departments);
      setStats(deptJson.stats ?? null);

      if (empJson.success && Array.isArray(empJson.employees)) {
        setEmployees(
          empJson.employees.map((row: { id: string; fullName: string }) => ({
            id: row.id,
            fullName: row.fullName,
          }))
        );
      }
    } catch {
      setError("Departmanlar yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreateModal() {
    setEditing(null);
    setName("");
    setDescription("");
    setColor("#2563eb");
    setManagerEmployeeId("");
    setIsActive(true);
    setModalOpen(true);
    setError("");
    setSuccess("");
  }

  function openEditModal(row: SerializedEmployeeDepartment) {
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? "");
    setColor(row.color ?? "#2563eb");
    setManagerEmployeeId(row.managerEmployee?.id ?? "");
    setIsActive(row.isActive);
    setModalOpen(true);
    setError("");
    setSuccess("");
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        name,
        description: description || null,
        color: color || null,
        managerEmployeeId: managerEmployeeId || null,
        isActive,
      };

      const res = await fetch(
        editing
          ? `/api/employees/departments/${editing.id}`
          : "/api/employees/departments",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Departman kaydedilemedi.");
        return;
      }

      setSuccess(editing ? "Departman güncellendi." : "Departman oluşturuldu.");
      setModalOpen(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function toggleDepartmentStatus(row: SerializedEmployeeDepartment) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        row.isActive
          ? `/api/employees/departments/${row.id}`
          : `/api/employees/departments/${row.id}`,
        {
          method: row.isActive ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          ...(row.isActive ? {} : { body: JSON.stringify({ isActive: true }) }),
        }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Departman durumu güncellenemedi.");
        return;
      }

      setSuccess(
        row.isActive ? "Departman pasifleştirildi." : "Departman aktifleştirildi."
      );
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

  return (
    <div className="space-y-5">
      <Link
        href="/team"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#0f1f4d]"
      >
        <ArrowLeft size={16} />
        Çalışanlar
      </Link>

      <section className={TEAM_HERO_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#0f1f4d] sm:text-[28px]">
                Departman Yönetimi
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Çalışan departmanlarını oluşturun, düzenleyin ve personel
                dağılımını takip edin.
              </p>
            </div>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0f1f4d] px-4 text-sm font-black text-white"
            >
              <Plus size={16} />
              Yeni Departman
            </button>
          ) : null}
        </div>

        {stats ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Aktif Departman"
              value={String(stats.activeCount)}
              icon={<Building2 size={18} />}
              color="blue"
            />
            <StatCard
              title="Pasif Departman"
              value={String(stats.passiveCount)}
              icon={<Building2 size={18} />}
              color="red"
            />
            <StatCard
              title="En Kalabalık"
              value={stats.busiestDepartment?.name ?? "—"}
              subtitle={
                stats.busiestDepartment
                  ? `${stats.busiestDepartment.employeeCount} çalışan`
                  : undefined
              }
              icon={<Building2 size={18} />}
              color="purple"
            />
            <StatCard
              title="Departmansız"
              value={String(stats.unassignedEmployeeCount)}
              subtitle="Atanmamış çalışan"
              icon={<Building2 size={18} />}
              color="orange"
            />
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {success}
        </div>
      ) : null}

      <section className={[TEAM_CARD_CLASS, "overflow-hidden"].join(" ")}>
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm font-semibold text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black uppercase tracking-wide text-[#24345f]/70">
                  <th className="px-5 py-3">Departman</th>
                  <th className="px-5 py-3">Açıklama</th>
                  <th className="px-5 py-3">Yönetici</th>
                  <th className="px-5 py-3">Çalışan</th>
                  <th className="px-5 py-3">Durum</th>
                  {canManage ? <th className="px-5 py-3">İşlemler</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((row) => (
                  <tr key={row.id} className="text-sm font-semibold text-[#24345f]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: row.color ?? "#94a3b8" }}
                        />
                        {row.name}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {row.description ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      {row.managerEmployee?.fullName ?? "—"}
                    </td>
                    <td className="px-5 py-4">{row.employeeCount}</td>
                    <td className="px-5 py-4">
                      {row.isActive ? "Aktif" : "Pasif"}
                    </td>
                    {canManage ? (
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => openEditModal(row)}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => toggleDepartmentStatus(row)}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black"
                          >
                            {row.isActive ? "Pasif yap" : "Aktif yap"}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && canManage ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div className={[TEAM_CARD_CLASS, "w-full max-w-lg"].join(" ")}>
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-black text-[#0f1f4d]">
                {editing ? "Departmanı Düzenle" : "Yeni Departman"}
              </h2>
            </div>
            <div className="space-y-4 p-5">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Ad *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Açıklama</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={[inputClass, "min-h-20 py-3"].join(" ")}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Renk</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Yönetici</span>
                <select
                  value={managerEmployeeId}
                  onChange={(e) => setManagerEmployeeId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Seçilmedi</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              </label>
              {editing ? (
                <label className="flex items-center gap-2 text-sm font-semibold text-[#0f1f4d]">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Aktif
                </label>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-black text-slate-500"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={saving || name.trim().length < 2}
                onClick={handleSubmit}
                className="rounded-xl bg-[#0f1f4d] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
