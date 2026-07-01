import { NextResponse } from "next/server";
import { requireMobileApiSession, mobileErrorResponse, MobileAuthError } from "@/lib/mobile/mobile-auth-guards";
import { db } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await requireMobileApiSession(req);

    const memberships = await db.companyUser.findMany({
      where: { userId: session.userId, status: "ACTIVE" },
      include: { company: true },
      orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
    });

    const companies = memberships
      .filter((cu) => cu.company?.status === "ACTIVE")
      .map((cu) => ({
        companyId: cu.companyId,
        companyName: cu.company?.name ?? "",
        role: cu.role,
        isOwner: cu.isOwner,
        companyStatus: cu.company?.status ?? "ACTIVE",
      }));

    return NextResponse.json(companies);
  } catch (err: unknown) {
    if (err instanceof MobileAuthError) {
      return mobileErrorResponse(err.code, err.message, err.status);
    }
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
