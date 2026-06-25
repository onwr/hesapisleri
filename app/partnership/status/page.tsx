import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PartnershipStatusClient } from "@/components/partnership/partnership-status-client";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { ensurePartnerSettings } from "@/lib/partner-conversion-service";
import { getPartnershipAccessState } from "@/lib/partnership-access";

export default async function PartnershipStatusPage() {
  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/partnership/status");
  }

  const payload = verifyToken<{ userId: string }>(token);
  if (!payload?.userId) {
    redirect("/login?next=/partnership/status");
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    redirect("/unauthorized");
  }

  const state = await getPartnershipAccessState(user.id, user.email);

  if (state.kind === "APPROVED") {
    redirect("/partnership/dashboard");
  }

  if (state.kind === "NONE") {
    redirect("/partnership/apply");
  }

  const settings = await ensurePartnerSettings();

  return (
    <AppShell>
      <PartnershipStatusClient
        kind={state.kind}
        application={state.application}
        canReapply={settings.isApplicationOpen}
      />
    </AppShell>
  );
}
