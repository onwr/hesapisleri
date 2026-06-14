"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { getCompanyUserStatusBadgeClass } from "@/lib/company-users-utils";

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
  updatedAt?: string;
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
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SettingsUsersPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<UsersPayload | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("STAFF");
  const [createdInviteLink, setCreatedInviteLink] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/settings/users");
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Kullanıcılar yüklenemedi.");
        return;
      }

      setData(json.data);
    } catch {
      setError("Kullanıcılar yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  async function handleRemoveUser(companyUserId: string) {
    if (!window.confirm("Bu kullanıcıyı firmadan çıkarmak istiyor musunuz?")) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/settings/users/${companyUserId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Kullanıcı çıkarılamadı.");
        return;
      }

      setSuccess("Kullanıcı firmadan çıkarıldı.");
      await loadUsers();
    } catch {
      setError("Kullanıcı çıkarılırken bir hata oluştu.");
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
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-8">
        <Loader2 className="animate-spin text-blue-600" size={22} />
        <span className="text-sm font-semibold text-slate-600">
          Ekip bilgileri yükleniyor...
        </span>
      </div>
    );
  }

  const canManage = data?.permissions.canManageUsers ?? false;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <p className="font-black">Bu alan sisteme giriş yapan kullanıcılar ve yetkiler içindir.</p>
        <p className="mt-1 font-semibold text-blue-900/80">
          Personel kayıtları için Çalışanlar sayfasını kullanın.
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
          <p className="font-black text-slate-950">Ekip Üyeleri</p>
          <p className="text-sm text-slate-500">
            {data?.users.length ?? 0} kullanıcı · {data?.invites.length ?? 0}{" "}
            bekleyen davet
          </p>
        </div>

        {canManage ? (
          <button
            type="button"
            onClick={() => {
              setInviteOpen(true);
              setCreatedInviteLink("");
              setError("");
              setSuccess("");
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white"
          >
            <UserPlus size={18} />
            Kullanıcı Davet Et
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Katılma</th>
              {canManage ? <th className="px-4 py-3">İşlemler</th> : null}
            </tr>
          </thead>
          <tbody>
            {data?.users.map((user) => {
              const isSelf = user.userId === data.permissions.currentUserId;
              const canEdit =
                canManage && !user.isOwner && user.role !== "OWNER" && !isSelf;

              return (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-950">
                    {user.name}
                    {user.isOwner ? (
                      <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700">
                        Sahip
                      </span>
                    ) : null}
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
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">
                        {user.roleLabel}
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
                    {formatDate(user.joinedAt)}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRemoveUser(user.id)}
                          className="inline-flex h-9 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-600"
                        >
                          <Trash2 size={14} />
                          Çıkar
                        </button>
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

      <div>
        <p className="mb-3 font-black text-slate-950">Bekleyen Davetler</p>

        {data?.invites.length ? (
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
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            Bekleyen davet bulunmuyor.
          </div>
        )}
      </div>

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
                  <p className="text-sm font-black text-green-800">
                    Davet linki hazır
                  </p>
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
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Check size={16} />
                )}
                Davet Oluştur
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
