import { AdminUsersContent } from "@/components/admin/admin-users-content";
import { getSuperAdminSession } from "@/lib/admin-auth";
import { getAdminUsers } from "@/lib/admin-service";

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

  const users = await getAdminUsers({
    q: params.q,
    status: params.status,
    role: params.role,
  });

  return (
    <AdminUsersContent
      users={users}
      filters={{
        q: params.q,
        status: params.status,
        role: params.role,
      }}
      currentUserId={user.id}
    />
  );
}
