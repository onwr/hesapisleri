import { NextResponse } from "next/server";
import { requireMobileApiSession, mobileErrorResponse, MobileAuthError } from "@/lib/mobile/mobile-auth-guards";
import { db } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await requireMobileApiSession(req);

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        companyUsers: {
          where: { status: "ACTIVE" },
          include: { company: true },
          orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!user) {
      return mobileErrorResponse("UNAUTHORIZED", "Kullanıcı bulunamadı.", 401);
    }

    const activeMemberships = user.companyUsers.filter(
      (cu) => cu.company?.status === "ACTIVE"
    );

    const currentMembership = session.companyId
      ? activeMemberships.find((cu) => cu.companyId === session.companyId)
      : activeMemberships[0];

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: currentMembership
        ? {
            companyId: currentMembership.companyId,
            companyName: currentMembership.company?.name ?? "",
            role: currentMembership.role,
            isOwner: currentMembership.isOwner,
            companyStatus: currentMembership.company?.status ?? "ACTIVE",
          }
        : null,
      companies: activeMemberships.map((cu) => ({
        companyId: cu.companyId,
        companyName: cu.company?.name ?? "",
        role: cu.role,
        isOwner: cu.isOwner,
        companyStatus: cu.company?.status ?? "ACTIVE",
      })),
    });
  } catch (err: unknown) {
    if (err instanceof MobileAuthError) {
      return mobileErrorResponse(err.code, err.message, err.status);
    }
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
