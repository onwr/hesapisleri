import type { UserRole } from "@prisma/client";
import {
  getCompanyUserStatusBadgeClass,
  getCompanyUserStatusLabel,
} from "@/lib/company-users-utils";
import { getUserRoleLabel } from "@/lib/settings-utils";

export type TeamTabKey = "active" | "all" | "passive" | "invites";

export type TeamSortKey = "joinedAt" | "name" | "role";

export type TeamMemberRow = {
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
  updatedAt: string;
};

export type TeamInviteRow = {
  id: string;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  expiresAt: string;
  createdAt?: string;
  inviteLink: string;
};

export type TeamStats = {
  activeCount: number;
  pendingInvites: number;
  adminCount: number;
  joinedLast30Days: number;
};

export const TEAM_TABS: Array<{ key: TeamTabKey; label: string }> = [
  { key: "active", label: "Aktif" },
  { key: "all", label: "Tümü" },
  { key: "passive", label: "Pasif" },
  { key: "invites", label: "Davetler" },
];

export const TEAM_ROLE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Tüm Roller" },
  { value: "OWNER", label: "Sahip" },
  { value: "ADMIN", label: "Yönetici" },
  { value: "ACCOUNTANT", label: "Muhasebeci" },
  { value: "STAFF", label: "Personel" },
];

export const TEAM_SORT_OPTIONS: Array<{ value: TeamSortKey; label: string }> = [
  { value: "joinedAt", label: "Katılım tarihi" },
  { value: "name", label: "Ad" },
  { value: "role", label: "Rol" },
];

export const ASSIGNABLE_TEAM_ROLES = [
  { value: "ADMIN", label: "Yönetici" },
  { value: "ACCOUNTANT", label: "Muhasebeci" },
  { value: "STAFF", label: "Personel" },
] as const;

export function parseTeamTab(value?: string | null): TeamTabKey {
  if (
    value === "all" ||
    value === "passive" ||
    value === "invites" ||
    value === "active"
  ) {
    return value;
  }
  return "active";
}

export function parseTeamSort(value?: string | null): TeamSortKey {
  if (value === "name" || value === "role") return value;
  return "joinedAt";
}

export function parseTeamRoleFilter(value?: string | null) {
  if (
    value === "OWNER" ||
    value === "ADMIN" ||
    value === "ACCOUNTANT" ||
    value === "STAFF"
  ) {
    return value;
  }
  return "";
}

export function parseTeamSearch(value?: string | null) {
  if (!value) return "";
  return value.trim();
}

export function getTeamMemberInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase() || "CU";
}

export function getTeamRoleBadgeClass(role: string, isOwner: boolean) {
  if (isOwner || role === "OWNER") {
    return "bg-violet-50 text-violet-700 border-violet-100/80";
  }
  if (role === "ADMIN") {
    return "bg-blue-50 text-blue-700 border-blue-100/80";
  }
  if (role === "ACCOUNTANT") {
    return "bg-amber-50 text-amber-700 border-amber-100/80";
  }
  return "bg-slate-100 text-slate-700 border-slate-200/80";
}

export function getTeamDisplayRoleLabel(role: string, isOwner: boolean) {
  if (isOwner) return getUserRoleLabel("OWNER");
  return getUserRoleLabel(role as UserRole);
}

export function filterTeamMembersByTab(
  users: TeamMemberRow[],
  tab: TeamTabKey
) {
  if (tab === "invites") return [];
  if (tab === "active") {
    return users.filter((user) => user.status === "ACTIVE");
  }
  if (tab === "passive") {
    return users.filter((user) => user.status === "PASSIVE");
  }
  return users;
}

export function filterTeamMembersBySearch(users: TeamMemberRow[], search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return users;

  return users.filter(
    (user) =>
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
  );
}

export function filterTeamMembersByRole(
  users: TeamMemberRow[],
  roleFilter: string
) {
  if (!roleFilter) return users;

  if (roleFilter === "OWNER") {
    return users.filter((user) => user.isOwner || user.role === "OWNER");
  }

  return users.filter(
    (user) => !user.isOwner && user.role === roleFilter
  );
}

export function sortTeamMembers(users: TeamMemberRow[], sort: TeamSortKey) {
  const sorted = [...users];

  sorted.sort((a, b) => {
    if (sort === "name") {
      return a.name.localeCompare(b.name, "tr");
    }

    if (sort === "role") {
      const roleA = a.isOwner ? "OWNER" : a.role;
      const roleB = b.isOwner ? "OWNER" : b.role;
      return roleA.localeCompare(roleB, "tr");
    }

    return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
  });

  return sorted;
}

export function applyTeamMemberFilters(input: {
  users: TeamMemberRow[];
  tab: TeamTabKey;
  search: string;
  roleFilter: string;
  sort: TeamSortKey;
}) {
  let rows = filterTeamMembersByTab(input.users, input.tab);
  rows = filterTeamMembersBySearch(rows, input.search);
  rows = filterTeamMembersByRole(rows, input.roleFilter);
  return sortTeamMembers(rows, input.sort);
}

export function computeTeamStats(
  users: TeamMemberRow[],
  invites: TeamInviteRow[]
): TeamStats {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const activeUsers = users.filter((user) => user.status === "ACTIVE");

  return {
    activeCount: activeUsers.length,
    pendingInvites: invites.length,
    adminCount: activeUsers.filter(
      (user) => user.isOwner || user.role === "ADMIN"
    ).length,
    joinedLast30Days: activeUsers.filter(
      (user) => new Date(user.joinedAt).getTime() >= thirtyDaysAgo
    ).length,
  };
}

export function canEditTeamMember(input: {
  canManage: boolean;
  member: TeamMemberRow;
  currentUserId: string;
}) {
  if (!input.canManage) return false;
  if (input.member.isOwner || input.member.role === "OWNER") return false;
  if (input.member.userId === input.currentUserId) return false;
  return true;
}

export {
  getCompanyUserStatusLabel,
  getCompanyUserStatusBadgeClass,
};

export function formatTeamDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function buildTeamPageQuery(input: {
  tab?: TeamTabKey;
  q?: string;
  role?: string;
  sort?: TeamSortKey;
}) {
  const params = new URLSearchParams();

  if (input.tab && input.tab !== "active") {
    params.set("tab", input.tab);
  }
  if (input.q) params.set("q", input.q);
  if (input.role) params.set("role", input.role);
  if (input.sort && input.sort !== "joinedAt") {
    params.set("sort", input.sort);
  }

  const query = params.toString();
  return query ? `/team?${query}` : "/team";
}
