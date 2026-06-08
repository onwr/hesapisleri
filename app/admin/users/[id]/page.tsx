import { notFound } from "next/navigation";
import { AdminUserDetailContent } from "@/components/admin/admin-user-detail-content";
import { getSuperAdminSession } from "@/lib/admin-auth";
import { getAdminUserDetail } from "@/lib/admin-service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({ params }: PageProps) {
  const [{ user }, { id }] = await Promise.all([
    getSuperAdminSession(),
    params,
  ]);

  const targetUser = await getAdminUserDetail(id);

  if (!targetUser) {
    notFound();
  }

  return (
    <AdminUserDetailContent user={targetUser} currentUserId={user.id} />
  );
}
