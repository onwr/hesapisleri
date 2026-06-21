import { NextResponse } from "next/server";
import { requireAuthenticatedApiSession } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { resolveEffectiveRole } from "@/lib/permission-utils";

export async function GET() {
  try {
    const auth = await requireAuthenticatedApiSession();
    if ("error" in auth) return auth.error;

    const { session } = auth;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        companyUsers: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Kullanıcı bulunamadı.",
        },
        { status: 404 }
      );
    }

    const activeCompany =
      user.companyUsers.find((item) => item.companyId === session.companyId)
        ?.company ?? user.companyUsers[0]?.company ?? null;

    const activeMembership =
      user.companyUsers.find((item) => item.companyId === session.companyId) ??
      user.companyUsers[0] ??
      null;

    const employee = activeMembership
      ? await db.employee.findFirst({
          where: {
            companyId: activeMembership.companyId,
            companyUserId: activeMembership.id,
          },
          select: { firstName: true, lastName: true },
        })
      : null;

    const effectiveRole = activeMembership
      ? resolveEffectiveRole({
          role: activeMembership.role,
          isOwner: activeMembership.isOwner,
        })
      : user.role;

    const employeeName = employee
      ? [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim()
      : null;

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        company: activeCompany
          ? {
              id: activeCompany.id,
              name: activeCompany.name,
              email: activeCompany.email,
              phone: activeCompany.phone,
              taxNo: activeCompany.taxNo,
              taxOffice: activeCompany.taxOffice,
              address: activeCompany.address,
              logoUrl: activeCompany.logoUrl,
            }
          : null,
        membership: activeMembership
          ? {
              role: activeMembership.role,
              effectiveRole,
              isOwner: activeMembership.isOwner,
            }
          : null,
        employeeName,
      },
    });
  } catch (error) {
    console.error("ME_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Kullanıcı bilgileri alınamadı.",
      },
      { status: 500 }
    );
  }
}
