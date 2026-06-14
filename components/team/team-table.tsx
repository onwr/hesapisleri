"use client";

import { Loader2, Trash2 } from "lucide-react";
import { TeamRoleBadge, TeamStatusBadge } from "@/components/team/team-role-badge";
import {
  ASSIGNABLE_TEAM_ROLES,
  canEditTeamMember,
  formatTeamDateTime,
  getTeamMemberInitials,
  type TeamMemberRow,
} from "@/lib/team-page-utils";

type TeamTableProps = {
  rows: TeamMemberRow[];
  canManage: boolean;
  currentUserId: string;
  saving: boolean;
  onRoleChange: (companyUserId: string, role: string) => void;
  onRemove: (companyUserId: string) => void;
};

export function TeamTable({
  rows,
  canManage,
  currentUserId,
  saving,
  onRoleChange,
  onRemove,
}: TeamTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black uppercase tracking-wide text-[#24345f]/70">
            <th className="px-5 py-3">Çalışan</th>
            <th className="px-5 py-3">E-posta</th>
            <th className="px-5 py-3">Rol</th>
            <th className="px-5 py-3">Durum</th>
            <th className="px-5 py-3">Katılım</th>
            <th className="px-5 py-3">Güncelleme</th>
            {canManage ? <th className="px-5 py-3 text-center">İşlemler</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((member) => {
            const editable = canEditTeamMember({
              canManage,
              member,
              currentUserId,
            });

            return (
              <tr
                key={member.id}
                className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
              >
                <td className="px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-violet-600 text-xs font-black text-white">
                      {getTeamMemberInitials(member.name, member.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-[#0f1f4d]">
                        {member.name}
                      </p>
                      {member.isOwner ? (
                        <p className="mt-0.5 text-[10px] font-bold text-violet-600">
                          Firma Sahibi
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-600">{member.email}</td>
                <td className="px-5 py-4">
                  {editable ? (
                    <select
                      value={member.role}
                      disabled={saving}
                      onChange={(event) =>
                        onRoleChange(member.id, event.target.value)
                      }
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    >
                      {ASSIGNABLE_TEAM_ROLES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TeamRoleBadge role={member.role} isOwner={member.isOwner} />
                  )}
                </td>
                <td className="px-5 py-4">
                  <TeamStatusBadge
                    status={member.status}
                    statusLabel={member.statusLabel}
                  />
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {formatTeamDateTime(member.joinedAt)}
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {formatTeamDateTime(member.updatedAt)}
                </td>
                {canManage ? (
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center">
                      {editable ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onRemove(member.id)}
                          className="inline-flex h-9 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Pasif Yap
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
