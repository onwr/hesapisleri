import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PartnerApplyForm } from "@/components/partner/partner-apply-form";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { ensurePartnerSettings } from "@/lib/partner-conversion-service";
import { getPartnershipAccessState } from "@/lib/partnership-access";

export default async function PartnershipApplyPage() {
  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/partnership/apply");
  }

  const payload = verifyToken<{ userId: string }>(token);
  if (!payload?.userId) {
    redirect("/login?next=/partnership/apply");
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

  if (state.kind === "PENDING" || state.kind === "REJECTED") {
    redirect("/partnership/status");
  }

  const settings = await ensurePartnerSettings();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
            Ortaklık Programı
          </p>
          <h1 className="mt-1 text-[24px] font-extrabold text-[#0f1f4d]">
            Ortaklık Başvurusu
          </h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Bizi önerin, komisyon kazanın. Onay sonrası referans linkiniz ve panel
            erişiminiz açılır.
          </p>
        </div>

        {!settings.isApplicationOpen ? (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
            Başvurular şu anda kapalıdır.
          </div>
        ) : null}

        <div className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)] md:p-6">
          <PartnerApplyForm defaultEmail={user.email} />
        </div>
      </div>
    </AppShell>
  );
}
