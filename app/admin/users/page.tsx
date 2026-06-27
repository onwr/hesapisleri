import { Suspense } from "react";
import { AdminUsersListContent } from "@/components/admin/users/admin-users-list-content";
import { getSuperAdminSession } from "@/lib/admin-auth";
import {
  getAdminUserList,
  getAdminUsersSummaryExtended,
} from "@/lib/admin/users/admin-user-list-service";
import { adminUserListQuerySchema } from "@/lib/admin/users/admin-user-schemas";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const [, rawParams] = await Promise.all([
    getSuperAdminSession(),
    searchParams,
  ]);

  const query = adminUserListQuerySchema.parse({
    q: rawParams.q,
    status: rawParams.status,
    platformRole: rawParams.platformRole,
    loginStatus: rawParams.loginStatus,
    sortBy: rawParams.sortBy,
    sortDir: rawParams.sortDir,
    page: rawParams.page,
    pageSize: rawParams.pageSize,
    companyCount: rawParams.companyCount,
  });

  const [list, summary] = await Promise.all([
    getAdminUserList(query),
    getAdminUsersSummaryExtended(),
  ]);

  return (
    <Suspense>
      <AdminUsersListContent
        list={list}
        summary={summary}
        filters={{
          q: query.q,
          status: query.status,
          platformRole: query.platformRole,
          loginStatus: query.loginStatus,
          sortBy: query.sortBy,
          sortDir: query.sortDir,
          page: query.page,
        }}
      />
    </Suspense>
  );
}
