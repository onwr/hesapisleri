import { redirect } from "next/navigation";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import {
  getPartnershipAccessState,
  resolvePartnershipHref,
} from "@/lib/partnership-access";

export default async function PartnershipIndexPage() {
  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/partnership");
  }

  const payload = verifyToken<{ userId: string }>(token);
  if (!payload?.userId) {
    redirect("/login?next=/partnership");
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    redirect("/unauthorized");
  }

  const state = await getPartnershipAccessState(user.id, user.email);
  redirect(resolvePartnershipHref(state));
}
