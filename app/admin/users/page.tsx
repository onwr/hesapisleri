import { AdminUsersContent } from "@/components/admin/admin-users-content";
import { getSuperAdminSession } from "@/lib/admin-auth";
import { getAdminUsers, getAdminUsersSummary } from "@/lib/admin-service";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    role?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const [{ user }, params] = await Promise.all([
    getSuperAdminSession(),
    searchParams,
  ]);

  const [users, summary] = await Promise.all([
    getAdminUsers({
      q: params.q,
      status: params.status,
      role: params.role,
    }),
    getAdminUsersSummary(),
  ]);

  return (
    <AdminUsersContent
      users={users}
      summary={summary}
      filters={{
        q: params.q,
        status: params.status,
        role: params.role,
      }}
      currentUserId={user.id}
    />
  );
}
