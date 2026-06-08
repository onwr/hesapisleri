"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type AdminUserActionsProps = {
  userId: string;
  userName: string;
  role: string;
  status: string;
  isSelf: boolean;
  mode?: "row" | "detail";
};

export function AdminUserActions({
  userId,
  userName,
  role,
  status,
  isSelf,
  mode = "row",
}: AdminUserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function patchUser(body: Record<string, unknown>) {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok || !result.success) {
      setError(result.message || "İşlem başarısız.");
      return;
    }

    router.refresh();
  }

  async function toggleSuperAdmin() {
    const nextRole = role === "SUPER_ADMIN" ? "OWNER" : "SUPER_ADMIN";
    await patchUser({ role: nextRole });
  }

  async function toggleStatus() {
    const nextStatus = status === "ACTIVE" ? "PASSIVE" : "ACTIVE";
    await patchUser({ status: nextStatus });
  }

  if (mode === "row") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleSuperAdmin}
          disabled={loading || (isSelf && role === "SUPER_ADMIN")}
          className="text-left text-[12px] font-bold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : role === "SUPER_ADMIN" ? (
            "Super Admin Kaldır"
          ) : (
            "Super Admin Yap"
          )}
        </button>
        <button
          type="button"
          onClick={toggleStatus}
          disabled={loading || isSelf}
          className="text-left text-[12px] font-bold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {status === "ACTIVE" ? "Pasife Al" : "Aktife Al"}
        </button>
        {error ? (
          <span className="text-[11px] font-medium text-rose-500">{error}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleSuperAdmin}
          disabled={loading || (isSelf && role === "SUPER_ADMIN")}
          className="rounded-2xl bg-[#0f1f4d] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {role === "SUPER_ADMIN" ? "Super Admin Kaldır" : "Super Admin Yap"}
        </button>
        <button
          type="button"
          onClick={toggleStatus}
          disabled={loading || isSelf}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-700 disabled:opacity-60"
        >
          {status === "ACTIVE" ? "Kullanıcıyı Pasife Al" : "Kullanıcıyı Aktife Al"}
        </button>
      </div>
      {error ? (
        <p className="text-[13px] font-medium text-rose-500">{error}</p>
      ) : null}
      {isSelf ? (
        <p className="text-[12px] text-slate-500">
          Kendi Super Admin yetkinizi veya hesap durumunuzu buradan değiştiremezsiniz.
        </p>
      ) : null}
      <p className="text-[12px] text-slate-500">
        {userName} için platform düzeyinde rol ve durum yönetimi.
      </p>
    </div>
  );
}
