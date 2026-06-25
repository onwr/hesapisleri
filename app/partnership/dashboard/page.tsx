import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PartnerDashboardClient } from "@/components/partner/partner-dashboard-client";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getPartnershipAccessState } from "@/lib/partnership-access";

export default async function PartnershipDashboardPage() {
  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/partnership/dashboard");
  }

  const payload = verifyToken<{ userId: string }>(token);
  if (!payload?.userId) {
    redirect("/login?next=/partnership/dashboard");
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    redirect("/unauthorized");
  }

  const state = await getPartnershipAccessState(user.id, user.email);

  if (state.kind !== "APPROVED") {
    redirect(state.kind === "NONE" ? "/partnership/apply" : "/partnership/status");
  }

  return (
    <AppShell>
      <PartnerDashboardClient />
    </AppShell>
  );
}
