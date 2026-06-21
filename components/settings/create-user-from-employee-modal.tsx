"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import {
  getAssignableRoleOptions,
  getRoleDescription,
  getRoleModulePreview,
  type AssignableCompanyUserRole,
} from "@/lib/company-user-from-employee-utils";

type EmployeeOption = {
  id: string;
  name: string;
  email: string | null;
  hasUserAccount: boolean;
};

type CreateUserFromEmployeeModalProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    employeeId: string;
    email: string;
    password: string;
    passwordConfirm: string;
    role: AssignableCompanyUserRole;
    status: "ACTIVE" | "PASSIVE";
  }) => Promise<void>;
  preselectedEmployeeId?: string;
  preselectedEmail?: string;
};

export function CreateUserFromEmployeeModal({
  open,
  saving,
  onClose,
  onSubmit,
  preselectedEmployeeId,
  preselectedEmail,
}: CreateUserFromEmployeeModalProps) {
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState(preselectedEmployeeId ?? "");
  const [email, setEmail] = useState(preselectedEmail ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<AssignableCompanyUserRole>("STAFF");
  const [status, setStatus] = useState<"ACTIVE" | "PASSIVE">("ACTIVE");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setEmployeeId(preselectedEmployeeId ?? "");
    setEmail(preselectedEmail ?? "");
    setPassword("");
    setPasswordConfirm("");
    setRole("STAFF");
    setStatus("ACTIVE");
    setError("");

    async function loadEmployees() {
      setLoadingEmployees(true);
      try {
        const res = await fetch("/api/settings/users/employee-options");
        const json = await res.json();
        if (res.ok && json.success) {
          setEmployees(json.data.employees ?? []);
        }
      } finally {
        setLoadingEmployees(false);
      }
    }

    void loadEmployees();
  }, [open, preselectedEmployeeId, preselectedEmail]);

  const selectedEmployee = useMemo(
    () => employees.find((entry) => entry.id === employeeId) ?? null,
    [employees, employeeId]
  );

  useEffect(() => {
    if (!selectedEmployee) return;
    if (!email && selectedEmployee.email) {
      setEmail(selectedEmployee.email);
    }
  }, [selectedEmployee, email]);

  const modulePreview = useMemo(() => getRoleModulePreview(role), [role]);

  if (!open) return null;

  async function handleSubmit() {
    setError("");

    if (!employeeId) {
      setError("Personel seçmelisiniz.");
      return;
    }

    if (!email.trim()) {
      setError("E-posta zorunludur.");
      return;
    }

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    if (!role) {
      setError("Rol seçmelisiniz.");
      return;
    }

    try {
      await onSubmit({
        employeeId,
        email: email.trim(),
        password,
        passwordConfirm,
        role,
        status,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Kullanıcı oluşturulamadı."
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              Personelden Kullanıcı Oluştur
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Seçilen personele e-posta, şifre ve rol tanımlayın.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Personel Seç
            </span>
            {loadingEmployees ? (
              <div className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={16} />
                Personel listesi yükleniyor...
              </div>
            ) : (
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Personel seçin</option>
                {employees.map((entry) => (
                  <option
                    key={entry.id}
                    value={entry.id}
                    disabled={entry.hasUserAccount}
                  >
                    {entry.name}
                    {entry.hasUserAccount ? " (hesabı var)" : ""}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              E-posta
            </span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="personel@firma.com"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Şifre
              </span>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 pr-12 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="En az 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Şifre Tekrar
              </span>
              <input
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                type={showPassword ? "text" : "password"}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Şifreyi tekrar girin"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Rol / Yetki
              </span>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as AssignableCompanyUserRole)
                }
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                {getAssignableRoleOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {getRoleDescription(role)}
              </p>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Durum
              </span>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "ACTIVE" | "PASSIVE")
                }
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="ACTIVE">Aktif</option>
                <option value="PASSIVE">Pasif</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-800">Modül Yetkileri</p>
            <p className="mt-1 text-xs text-slate-500">
              Yetkiler role göre otomatik atanır.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {modulePreview
                .filter((entry) => entry.allowed)
                .map((entry) => (
                  <span
                    key={entry.module}
                    className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700"
                  >
                    {entry.label}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={saving || loadingEmployees}
            onClick={() => void handleSubmit()}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Kullanıcı Oluştur
          </button>
        </div>
      </div>
    </div>
  );
}

type ResetUserPasswordModalProps = {
  open: boolean;
  saving: boolean;
  userLabel: string;
  onClose: () => void;
  onSubmit: (payload: { password: string; passwordConfirm: string }) => Promise<void>;
};

export function ResetUserPasswordModal({
  open,
  saving,
  userLabel,
  onClose,
  onSubmit,
}: ResetUserPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setPasswordConfirm("");
    setError("");
  }, [open]);

  if (!open) return null;

  async function handleSubmit() {
    setError("");

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    try {
      await onSubmit({ password, passwordConfirm });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Şifre güncellenemedi."
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Yeni Şifre Belirle</h3>
            <p className="mt-1 text-sm text-slate-500">{userLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Yeni Şifre
            </span>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 pr-12 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Şifre Tekrar
            </span>
            <input
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              type={showPassword ? "text" : "password"}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600"
          >
            İptal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmployeeLinkBadge({
  employee,
}: {
  employee: { id: string; name: string } | null;
}) {
  if (!employee) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
        Personel bağlantısı yok
      </span>
    );
  }

  return (
    <Link
      href={`/team/${employee.id}`}
      className="font-semibold text-blue-700 hover:underline"
    >
      {employee.name}
    </Link>
  );
}
