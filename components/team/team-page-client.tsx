"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { EmployeeCreateModal } from "@/components/employees/employee-create-modal";
import { EmployeeEditModal } from "@/components/employees/employee-edit-modal";
import { EmployeeFilters } from "@/components/employees/employee-filters";
import {
  EmployeeEmptyState,
  EmployeeTable,
} from "@/components/employees/employee-table";
import { TeamShell } from "@/components/team/team-shell";
import type { SerializedEmployee } from "@/lib/employee-page-types";
import {
  applyEmployeeFilters,
  buildEmployeePageQuery,
  type EmployeeSortKey,
  type EmployeeStats,
  type EmployeeTabKey,
} from "@/lib/employee-page-utils";
import type { EmployeeModulePermissions } from "@/lib/employee-permission-utils";

type TeamPageClientProps = {
  initialEmployees: SerializedEmployee[];
  initialSummary: EmployeeStats;
  employeePermissions: EmployeeModulePermissions;
  initialTab: EmployeeTabKey;
  initialSearch: string;
  initialDepartment: string;
  initialJobTitle: string;
  initialStatus: string;
  initialEmploymentType: string;
  initialSort: EmployeeSortKey;
};

export function TeamPageClient({
  initialEmployees,
  initialSummary,
  employeePermissions,
  initialTab,
  initialSearch,
  initialDepartment,
  initialJobTitle,
  initialStatus,
  initialEmploymentType,
  initialSort,
}: TeamPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [employees, setEmployees] = useState(initialEmployees);
  const [summary, setSummary] = useState(initialSummary);
  const [tab, setTab] = useState<EmployeeTabKey>(initialTab);
  const [search, setSearch] = useState(initialSearch);
  const [department, setDepartment] = useState(initialDepartment);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [status, setStatus] = useState(initialStatus);
  const [employmentType, setEmploymentType] = useState(initialEmploymentType);
  const [sort, setSort] = useState<EmployeeSortKey>(initialSort);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<SerializedEmployee | null>(
    null
  );

  const departments = useMemo(
    () =>
      [
        ...new Set(
          employees.map((e) => e.department).filter(Boolean) as string[]
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    [employees]
  );

  const jobTitles = useMemo(
    () =>
      [
        ...new Set(
          employees.map((e) => e.jobTitle).filter(Boolean) as string[]
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    [employees]
  );

  const filteredEmployees = useMemo(
    () =>
      applyEmployeeFilters({
        employees,
        tab,
        search,
        department,
        jobTitle,
        status,
        employmentType,
        sort,
      }),
    [
      employees,
      tab,
      search,
      department,
      jobTitle,
      status,
      employmentType,
      sort,
    ]
  );

  const canManageEmployees = employeePermissions.canManageRecords;
  const hasFilters = Boolean(
    search || department || jobTitle || status || employmentType
  );

  const updateQuery = useCallback(
    (next: Partial<{
      tab: EmployeeTabKey;
      q: string;
      department: string;
      jobTitle: string;
      status: string;
      employmentType: string;
      sort: EmployeeSortKey;
    }>) => {
      const href = buildEmployeePageQuery({
        tab: next.tab ?? tab,
        q: next.q ?? search,
        department: next.department ?? department,
        jobTitle: next.jobTitle ?? jobTitle,
        status: next.status ?? status,
        employmentType: next.employmentType ?? employmentType,
        sort: next.sort ?? sort,
      });

      startTransition(() => {
        router.replace(href);
      });
    },
    [
      router,
      department,
      jobTitle,
      status,
      employmentType,
      search,
      sort,
      tab,
    ]
  );

  const reloadData = useCallback(async () => {
    const empRes = await fetch("/api/employees");
    const empJson = await empRes.json();

    if (!empRes.ok || !empJson.success) {
      throw new Error(empJson.message || "Çalışanlar yüklenemedi.");
    }

    setEmployees(empJson.employees);
    setSummary(empJson.summary);
  }, []);

  async function handleCreateEmployee(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Çalışan oluşturulamadı.");
        return;
      }

      setSuccess("Çalışan kaydı oluşturuldu.");
      await reloadData();
      router.push(`/team/${json.employee.id}`);
    } catch {
      setError("Çalışan oluşturulurken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditEmployee(payload: Record<string, unknown>) {
    if (!editEmployee) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/employees/${editEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Çalışan güncellenemedi.");
        return;
      }

      setSuccess("Çalışan bilgileri güncellendi.");
      setEditEmployee(null);
      await reloadData();
    } catch {
      setError("Çalışan güncellenirken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(employeeId: string) {
    if (
      !window.confirm(
        "Bu pasif çalışan kaydı kalıcı olarak sonlandırılacak. Devam etmek istiyor musunuz?"
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Çalışan kaydı silinemedi.");
        return;
      }

      setSuccess("Çalışan kaydı sonlandırıldı.");
      await reloadData();
    } catch {
      setError("İşlem sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(employeeId: string) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/employees/${employeeId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Çalışan aktif yapılamadı.");
        return;
      }

      setSuccess("Çalışan aktif duruma alındı.");
      await reloadData();
    } catch {
      setError("İşlem sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePassivate(employeeId: string) {
    if (!window.confirm("Bu çalışanı pasif yapmak istiyor musunuz?")) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/employees/${employeeId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PASSIVE" }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Çalışan pasif yapılamadı.");
        return;
      }

      setSuccess("Çalışan pasif duruma alındı.");
      await reloadData();
    } catch {
      setError("İşlem sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  function handleQuickPayment(employee: SerializedEmployee) {
    router.push(`/team/${employee.id}?tab=payments`);
  }

  function handleQuickLeave(employee: SerializedEmployee) {
    router.push(`/team/${employee.id}?tab=leaves`);
  }

  function handleManagePos(employee: SerializedEmployee) {
    router.push(`/team/${employee.id}?tab=pos`);
  }

  function clearFilters() {
    setSearch("");
    setDepartment("");
    setJobTitle("");
    setStatus("");
    setEmploymentType("");
    setTab("active");
    updateQuery({
      tab: "active",
      q: "",
      department: "",
      jobTitle: "",
      status: "",
      employmentType: "",
    });
  }

  return (
    <>
      <TeamShell
        stats={summary}
        canManageEmployees={canManageEmployees}
        isReadOnlyViewer={employeePermissions.isReadOnlyViewer}
        onCreateEmployee={() => {
          setCreateOpen(true);
          setError("");
          setSuccess("");
        }}
      >
        {error ? (
          <div className="mx-4 mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:mx-5">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mx-4 mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 sm:mx-5">
            {success}
          </div>
        ) : null}

        <EmployeeFilters
          tab={tab}
          search={search}
          department={department}
          jobTitle={jobTitle}
          status={status}
          employmentType={employmentType}
          sort={sort}
          departments={departments}
          jobTitles={jobTitles}
          onTabChange={(nextTab) => {
            setTab(nextTab);
            updateQuery({ tab: nextTab });
          }}
          onSearchChange={(value) => {
            setSearch(value);
            updateQuery({ q: value });
          }}
          onDepartmentChange={(value) => {
            setDepartment(value);
            updateQuery({ department: value });
          }}
          onJobTitleChange={(value) => {
            setJobTitle(value);
            updateQuery({ jobTitle: value });
          }}
          onStatusChange={(value) => {
            setStatus(value);
            updateQuery({ status: value });
          }}
          onEmploymentTypeChange={(value) => {
            setEmploymentType(value);
            updateQuery({ employmentType: value });
          }}
          onSortChange={(value) => {
            setSort(value);
            updateQuery({ sort: value });
          }}
        />

        {(saving || isPending) ? (
          <div className="flex items-center gap-2 px-5 py-3 text-xs font-semibold text-slate-500">
            <Loader2 size={14} className="animate-spin" />
            Güncelleniyor...
          </div>
        ) : null}

        {filteredEmployees.length > 0 ? (
          <EmployeeTable
            rows={filteredEmployees}
            canManage={canManageEmployees}
            saving={saving}
            onPassivate={handlePassivate}
            onActivate={handleActivate}
            onDelete={handleDelete}
            onAddPayment={handleQuickPayment}
            onAddLeave={handleQuickLeave}
            onEdit={setEditEmployee}
            onManagePos={handleManagePos}
          />
        ) : (
          <EmployeeEmptyState
            tab={tab}
            hasFilters={hasFilters}
            canManage={canManageEmployees}
            onClear={hasFilters ? clearFilters : undefined}
            onCreate={() => setCreateOpen(true)}
          />
        )}
      </TeamShell>

      <EmployeeCreateModal
        open={createOpen}
        saving={saving}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateEmployee}
      />

      <EmployeeEditModal
        open={Boolean(editEmployee)}
        saving={saving}
        employee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onSubmit={handleEditEmployee}
      />
    </>
  );
}
