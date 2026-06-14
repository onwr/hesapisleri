import {
  getCompanyUserStatusBadgeClass,
  getTeamDisplayRoleLabel,
  getTeamRoleBadgeClass,
} from "@/lib/team-page-utils";

type TeamRoleBadgeProps = {
  role: string;
  isOwner: boolean;
};

export function TeamRoleBadge({ role, isOwner }: TeamRoleBadgeProps) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black",
        getTeamRoleBadgeClass(role, isOwner),
      ].join(" ")}
    >
      {getTeamDisplayRoleLabel(role, isOwner)}
    </span>
  );
}

type TeamStatusBadgeProps = {
  status: string;
  statusLabel: string;
};

export function TeamStatusBadge({ status, statusLabel }: TeamStatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black",
        getCompanyUserStatusBadgeClass(status),
      ].join(" ")}
    >
      {statusLabel}
    </span>
  );
}
