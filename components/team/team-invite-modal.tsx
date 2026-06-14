"use client";

import { Check, Copy, Loader2, X } from "lucide-react";
import { ASSIGNABLE_TEAM_ROLES } from "@/lib/team-page-utils";

type TeamInviteModalProps = {
  open: boolean;
  saving: boolean;
  email: string;
  role: string;
  createdInviteLink: string;
  onClose: () => void;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onSubmit: () => void;
  onCopy: (text: string) => void;
};

export function TeamInviteModal({
  open,
  saving,
  email,
  role,
  createdInviteLink,
  onClose,
  onEmailChange,
  onRoleChange,
  onSubmit,
  onCopy,
}: TeamInviteModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-[#0f1f4d]">
              Çalışan Davet Et
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Davet linkini kopyalayıp paylaşın.
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

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              E-posta
            </span>
            <input
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
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
              value={role}
              onChange={(event) => onRoleChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {ASSIGNABLE_TEAM_ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div
            className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500"
            title="E-posta gönderimi sonraki fazda eklenecek."
          >
            E-posta gönderimi sonraki fazda eklenecek. Şimdilik davet linkini
            kopyalayarak paylaşabilirsiniz.
          </div>

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
                onClick={() => onCopy(createdInviteLink)}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-green-600 px-4 text-xs font-black text-white"
              >
                <Copy size={14} />
                Linki Kopyala
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600"
          >
            Kapat
          </button>
          <button
            type="button"
            disabled={saving || !email}
            onClick={onSubmit}
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
  );
}
