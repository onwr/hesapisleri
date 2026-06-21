import { getAuthToken, verifyToken } from "@/lib/auth";
import { getSuperAdminSession } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/layout/admin-shell";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSuperAdminSession();

  const token = await getAuthToken();
  const payload = token ? verifyToken<AuthPayload>(token) : null;
  const companyId = payload?.companyId ?? null;

  return (
    <AdminShell user={user} companyId={companyId}>
      {children}
    </AdminShell>
  );
}
