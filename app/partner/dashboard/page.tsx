import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PartnerDashboardClient } from "@/components/partner/partner-dashboard-client";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { resolvePartnerForUser } from "@/lib/partner-service";

export default async function PartnerDashboardPage() {
  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/partner/dashboard");
  }

  const payload = verifyToken<{ userId: string }>(token);

  if (!payload?.userId) {
    redirect("/login?next=/partner/dashboard");
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    redirect("/unauthorized");
  }

  const partner = await resolvePartnerForUser(user.id, user.email);

  if (!partner) {
    redirect("/partner/apply");
  }

  return (
    <AppShell>
      <PartnerDashboardClient />
    </AppShell>
  );
}
