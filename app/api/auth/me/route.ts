import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";

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
