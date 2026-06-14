"use client";

import { useState } from "react";
import { Loader2, ScanBarcode } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import type { SerializedEmployee } from "@/lib/employee-page-types";

type EmployeePosTabProps = {
  employee: SerializedEmployee;
  canManage: boolean;
  onUpdated: (employee: SerializedEmployee) => void;
};

export function EmployeePosTab({
  employee,
  canManage,
  onUpdated,
}: EmployeePosTabProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleCreate() {
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/employees/${employee.id}/pos-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "POS hesabı oluşturulamadı.");
        return;
      }
      setSuccess("POS erişimi oluşturuldu.");
      onUpdated(json.employee);
      setUsername("");
      setPassword("");
      setPasswordConfirm("");
    } finally {
      setSaving(false);
    }
  }

  async function handlePatch(body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/employees/${employee.id}/pos-account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "POS erişimi güncellenemedi.");
        return;
      }
      setSuccess("POS erişimi güncellendi.");
      onUpdated(json.employee);
      setNewPassword("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    if (!window.confirm("POS erişimini kapatmak istiyor musunuz?")) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/employees/${employee.id}/pos-account`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "POS erişimi kapatılamadı.");
        return;
      }
      setSuccess("POS erişimi kapatıldı.");
      onUpdated(json.employee);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </p>
      ) : null}

      {employee.hasPosAccess && employee.posAccount ? (
        <div className={[TEAM_CARD_CLASS, "p-5"].join(" ")}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ScanBarcode size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-[#0f1f4d]">
                POS erişimi aktif
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Bu hesap yalnızca Hızlı Satış / POS ekranına erişebilir.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoRow label="Kullanıcı adı" value={employee.posAccount.username} />
            <InfoRow label="Durum" value={employee.posAccount.statusLabel} />
          </div>

          {canManage ? (
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">
                  Yeni şifre
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || newPassword.length < 6}
                  onClick={() => handlePatch({ password: newPassword })}
                  className="rounded-2xl bg-[#0f1f4d] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Şifre yenile
                </button>
                {employee.posAccount.status === "ACTIVE" ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handlePatch({ status: "PASSIVE" })}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-700"
                  >
                    POS erişimini pasif yap
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handlePatch({ status: "ACTIVE" })}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700"
                  >
                    POS erişimini aktif yap
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDisable}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-600"
                >
                  POS erişimini kapat
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : canManage ? (
        <div className={[TEAM_CARD_CLASS, "p-5"].join(" ")}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <ScanBarcode size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-[#0f1f4d]">
                POS erişimi yok
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Bu çalışan için yalnızca Hızlı Satış / POS ekranına erişebilecek
                özel bir hesap oluşturabilirsiniz.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">
                Kullanıcı adı
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                placeholder="ayse.pos"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">Şifre</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">
                Şifre tekrar
              </span>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={inputClass}
              />
            </label>
            <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">
              Bu hesap sadece POS / Hızlı Satış ekranına erişebilir.
            </p>
            <button
              type="button"
              disabled={
                saving ||
                username.length < 3 ||
                password.length < 6 ||
                password !== passwordConfirm
              }
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0f1f4d] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              POS Hesabı Oluştur
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-slate-500">
          POS erişimi bulunmuyor.
        </p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-extrabold text-[#0f1f4d]">{value}</p>
    </div>
  );
}
