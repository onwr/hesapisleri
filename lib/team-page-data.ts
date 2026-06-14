import { getCompanyUsersAndInvites } from "@/lib/company-users-service";
import {
  applyTeamMemberFilters,
  computeTeamStats,
  parseTeamRoleFilter,
  parseTeamSearch,
  parseTeamSort,
  parseTeamTab,
  type TeamInviteRow,
  type TeamMemberRow,
  type TeamSortKey,
  type TeamTabKey,
} from "@/lib/team-page-utils";

export async function getTeamPageData(input: {
  companyId: string;
  userId: string;
  baseUrl?: string;
  tab?: string | null;
  q?: string | null;
  role?: string | null;
  sort?: string | null;
}) {
  const tab = parseTeamTab(input.tab);
  const search = parseTeamSearch(input.q);
  const roleFilter = parseTeamRoleFilter(input.role);
  const sort = parseTeamSort(input.sort);

  const payload = await getCompanyUsersAndInvites({
    companyId: input.companyId,
    userId: input.userId,
    baseUrl: input.baseUrl,
  });

  const users = payload.users as TeamMemberRow[];
  const invites = payload.invites as TeamInviteRow[];
  const stats = computeTeamStats(users, invites);
  const filteredUsers = applyTeamMemberFilters({
    users,
    tab,
    search,
    roleFilter,
    sort,
  });

  return {
    users,
    invites,
    filteredUsers,
    stats,
    permissions: payload.permissions,
    filters: {
      tab,
      search,
      roleFilter,
      sort,
    },
  };
}

export type { TeamTabKey, TeamSortKey, TeamMemberRow, TeamInviteRow };
