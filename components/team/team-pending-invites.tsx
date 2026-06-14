"use client";

import { Copy, Loader2, X } from "lucide-react";
import { TeamRoleBadge } from "@/components/team/team-role-badge";
import { formatTeamDateTime, type TeamInviteRow } from "@/lib/team-page-utils";

type TeamPendingInvitesProps = {
  invites: TeamInviteRow[];
  canManage: boolean;
  saving: boolean;
  onCopy: (text: string) => void;
  onCancel: (inviteId: string) => void;
};

export function TeamPendingInvites({
  invites,
  canManage,
  saving,
  onCopy,
  onCancel,
}: TeamPendingInvitesProps) {
  if (invites.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 p-4 sm:p-5">
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex flex-col gap-4 rounded-[1.25rem] border border-slate-100 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate font-black text-[#0f1f4d]">{invite.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TeamRoleBadge role={invite.role} isOwner={false} />
              <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                Bekliyor
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Son geçerlilik: {formatTeamDateTime(invite.expiresAt)}
            </p>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCopy(invite.inviteLink)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                <Copy size={14} />
                Linki Kopyala
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => onCancel(invite.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <X size={14} />
                )}
                Daveti İptal Et
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
