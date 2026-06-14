import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { resolveEffectiveRole } from "@/lib/permission-utils";

type AuthPayload = {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
};

export async function GET() {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Oturum bulunamadı.",
        },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Oturum geçersiz.",
        },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
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
      user.companyUsers.find((item) => item.companyId === payload.companyId)
        ?.company ?? user.companyUsers[0]?.company ?? null;

    const activeMembership =
      user.companyUsers.find((item) => item.companyId === payload.companyId) ??
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
