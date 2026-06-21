"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  KeyRound,
  Loader2,
  UserPlus,
  X,
} from "lucide-react";
import {
  CreateUserFromEmployeeModal,
  EmployeeLinkBadge,
  ResetUserPasswordModal,
} from "@/components/settings/create-user-from-employee-modal";
import { getCompanyUserStatusBadgeClass } from "@/lib/company-users-utils";
import {
  getRoleModulePreview,
  type AssignableCompanyUserRole,
} from "@/lib/company-user-from-employee-utils";

type TeamUser = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  statusLabel: string;
  isOwner: boolean;
  joinedAt: string;
  lastLoginAt?: string | null;
  employee?: { id: string; name: string } | null;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  expiresAt: string;
  inviteLink: string;
};

type UsersPayload = {
  users: TeamUser[];
  invites: PendingInvite[];
  permissions: {
    canManageUsers: boolean;
    currentUserId: string;
    currentCompanyUserId: string | null;
  };
};

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Yönetici" },
  { value: "ACCOUNTANT", label: "Muhasebeci" },
  { value: "STAFF", label: "Personel" },
  { value: "POS_STAFF", label: "POS Personeli" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getModuleSummary(role: string) {
  if (!ROLE_OPTIONS.some((option) => option.value === role)) {
    return "—";
  }

  return getRoleModulePreview(role as AssignableCompanyUserRole)
    .filter((entry) => entry.allowed)
    .map((entry) => entry.label)
    .slice(0, 4)
    .join(", ");
}

export function SettingsUsersPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<UsersPayload | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("STAFF");
  const [createdInviteLink, setCreatedInviteLink] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<TeamUser | null>(null);
  const [employeeOptionsCount, setEmployeeOptionsCount] = useState<number | null>(
    null
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [usersRes, employeesRes] = await Promise.all([
        fetch("/api/settings/users"),
        fetch("/api/settings/users/employee-options"),
      ]);
      const json = await usersRes.json();

      if (!usersRes.ok || !json.success) {
        setError(json.message || "Kullanıcılar yüklenemedi.");
        return;
      }

      setData(json.data);

      if (employeesRes.ok) {
        const employeesJson = await employeesRes.json();
        if (employeesJson.success) {
          const employees = employeesJson.data.employees ?? [];
          setEmployeeOptionsCount(
            employees.filter(
              (entry: { hasUserAccount: boolean }) => !entry.hasUserAccount
            ).length
          );
        }
      }
    } catch {
      setError("Kullanıcılar yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleCreateFromEmployee(payload: {
    employeeId: string;
    email: string;
    password: string;
    passwordConfirm: string;
    role: AssignableCompanyUserRole;
    status: "ACTIVE" | "PASSIVE";
  }) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings/users/from-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Kullanıcı oluşturulamadı.");
      }

      setSuccess("Kullanıcı oluşturuldu.");
      setCreateOpen(false);
      await loadUsers();
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "Kullanıcı oluşturulurken bir hata oluştu.";
      setError(message);
      throw createError;
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(payload: {
    password: string;
    passwordConfirm: string;
  }) {
    if (!passwordTarget) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `/api/settings/users/${passwordTarget.id}/password`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Şifre güncellenemedi.");
      }

      setSuccess("Kullanıcı şifresi güncellendi.");
      setPasswordTarget(null);
    } catch (resetError) {
      const message =
        resetError instanceof Error
          ? resetError.message
          : "Şifre güncellenirken bir hata oluştu.";
      setError(message);
      throw resetError;
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInvite() {
    setSaving(true);
    setError("");
    setSuccess("");
    setCreatedInviteLink("");

    try {
      const res = await fetch("/api/settings/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Davet oluşturulamadı.");
        return;
      }

      setCreatedInviteLink(json.data.inviteLink);
      setSuccess("Davet oluşturuldu.");
      setInviteEmail("");
      await loadUsers();
    } catch {
      setError("Davet oluşturulurken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/settings/invites/${inviteId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Davet iptal edilemedi.");
        return;
      }

      setSuccess("Davet iptal edildi.");
      await loadUsers();
    } catch {
      setError("Davet iptal edilirken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(companyUserId: string, role: string) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/settings/users/${companyUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Rol güncellenemedi.");
        return;
      }

      setSuccess("Kullanıcı rolü güncellendi.");
      await loadUsers();
    } catch {
      setError("Rol güncellenirken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: TeamUser) {
    const nextStatus = user.status === "ACTIVE" ? "PASSIVE" : "ACTIVE";
    const label = nextStatus === "ACTIVE" ? "aktif" : "pasif";

    if (
      nextStatus === "PASSIVE" &&
      !window.confirm(`${user.name} kullanıcısını pasif yapmak istiyor musunuz?`)
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || `Kullanıcı ${label} yapılamadı.`);
        return;
      }

      setSuccess(`Kullanıcı ${label} yapıldı.`);
      await loadUsers();
    } catch {
      setError(`Kullanıcı ${label} yapılırken bir hata oluştu.`);
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Davet linki kopyalandı.");
    } catch {
      setError("Link kopyalanamadı.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-8">
        <Loader2 className="animate-spin text-[#0f1f4d]" size={22} />
        <span className="text-[12px] font-semibold text-slate-600">
          Kullanıcılar yükleniyor...
        </span>
      </div>
    );
  }

  const canManage = data?.permissions.canManageUsers ?? false;
  const hasUsers = (data?.users.length ?? 0) > 0;
  const hasAvailableEmployees = (employeeOptionsCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-[12px] text-blue-950">
        <p className="font-black">
          Sistem kullanıcıları personel kayıtlarından oluşturulur.
        </p>
        <p className="mt-1 font-semibold text-blue-900/80">
          Personel seçin, e-posta ve şifre tanımlayın; rol ile modül erişimini belirleyin.
        </p>
      </div>

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] font-black text-[#0f1f4d]">Kullanıcılar</p>
          <p className="text-[12px] text-slate-500">
            {data?.users.length ?? 0} kullanıcı · {data?.invites.length ?? 0}{" "}
            bekleyen davet
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {hasAvailableEmployees ? (
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(true);
                  setError("");
                  setSuccess("");
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f]"
              >
                <UserPlus size={16} />
                Personelden Kullanıcı Oluştur
              </button>
            ) : (
              <Link
                href="/team"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f]"
              >
                <UserPlus size={16} />
                Çalışan Ekle
              </Link>
            )}
          </div>
        ) : null}
      </div>

      {!hasUsers ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <p className="font-black text-slate-900">Henüz kullanıcı eklenmedi.</p>
          <p className="mt-2 text-sm text-slate-500">
            Personel kayıtlarınızdan sistem kullanıcısı oluşturarak yetki verebilirsiniz.
          </p>
          {!hasAvailableEmployees ? (
            <p className="mt-4 text-sm font-semibold text-amber-700">
              Önce personel ekleyin.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                <th className="px-4 py-3">Personel</th>
                <th className="px-4 py-3">E-posta</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Son giriş</th>
                <th className="px-4 py-3">Modül yetkileri</th>
                {canManage ? <th className="px-4 py-3">Aksiyonlar</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.users.map((user) => {
                const isSelf = user.userId === data.permissions.currentUserId;
                const canEdit =
                  canManage && !user.isOwner && user.role !== "OWNER" && !isSelf;

                return (
                  <tr
                    key={user.id}
                    className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-extrabold text-[#0f1f4d]">{user.name}</p>
                        <EmployeeLinkBadge employee={user.employee ?? null} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <select
                          value={user.role}
                          disabled={saving}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value)
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">
                          {user.roleLabel}
                          {user.isOwner ? " · Sahip" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-black",
                          getCompanyUserStatusBadgeClass(user.status),
                        ].join(" ")}
                      >
                        {user.statusLabel || user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(user.lastLoginAt ?? user.joinedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {getModuleSummary(user.role)}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setPasswordTarget(user)}
                              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
                            >
                              <KeyRound size={14} />
                              Şifre Belirle
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleToggleStatus(user)}
                              className="inline-flex h-9 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-700"
                            >
                              {user.status === "ACTIVE" ? "Pasif Yap" : "Aktif Yap"}
                            </button>
                            {user.employee ? (
                              <Link
                                href={`/team/${user.employee.id}`}
                                className="inline-flex h-9 items-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700"
                              >
                                Personel Kartı
                              </Link>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <details className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-700">
            E-posta daveti (alternatif)
          </summary>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-500">
              Davet linki ile kullanıcı oluşturma eski yöntemdir. Önerilen akış personelden kullanıcı oluşturmaktır.
            </p>
            <button
              type="button"
              onClick={() => {
                setInviteOpen(true);
                setCreatedInviteLink("");
                setError("");
                setSuccess("");
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
            >
              Kullanıcı Davet Et
            </button>
          </div>
        </details>
      ) : null}

      {data?.invites.length ? (
        <div>
          <p className="mb-3 font-black text-slate-950">Bekleyen Davetler</p>
          <div className="space-y-3">
            {data.invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <p className="font-black text-slate-950">{invite.email}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {invite.roleLabel} · Son geçerlilik:{" "}
                    {formatDate(invite.expiresAt)}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(invite.inviteLink)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
                    >
                      <Copy size={14} />
                      Linki Kopyala
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleCancelInvite(invite.id)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-600"
                    >
                      <X size={14} />
                      İptal Et
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <CreateUserFromEmployeeModal
        open={createOpen}
        saving={saving}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateFromEmployee}
      />

      <ResetUserPasswordModal
        open={Boolean(passwordTarget)}
        saving={saving}
        userLabel={passwordTarget?.name ?? ""}
        onClose={() => setPasswordTarget(null)}
        onSubmit={handleResetPassword}
      />

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-950">
                Kullanıcı Davet Et
              </h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  E-posta
                </span>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  type="email"
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="ornek@firma.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Rol
                </span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {createdInviteLink ? (
                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                  <p className="text-sm font-black text-green-800">Davet linki hazır</p>
                  <p className="mt-2 break-all text-xs text-green-700">
                    {createdInviteLink}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(createdInviteLink)}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-green-600 px-4 text-xs font-black text-white"
                  >
                    <Copy size={14} />
                    Kopyala
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600"
              >
                Kapat
              </button>
              <button
                type="button"
                disabled={saving || !inviteEmail}
                onClick={handleCreateInvite}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"
              >
                Davet Oluştur
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
