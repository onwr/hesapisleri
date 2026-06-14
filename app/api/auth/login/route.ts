import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { resolveLoginEmail } from "@/lib/employee-pos-utils";
import { getPostAuthRedirectPath, resolveEffectiveRole } from "@/lib/permission-utils";

const loginSchema = z.object({
  email: z.string().min(1, "E-posta veya kullanıcı adı zorunludur."),
  password: z.string().min(1, "Şifre zorunludur."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email: emailOrUsername, password } = parsed.data;

    let email: string;
    try {
      email = await resolveLoginEmail(emailOrUsername);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Giriş bilgileri çözümlenemedi.",
        },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
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
          message: "E-posta veya şifre hatalı.",
        },
        { status: 401 }
      );
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "E-posta veya şifre hatalı.",
        },
        { status: 401 }
      );
    }

    const activeMembership = user.companyUsers[0] ?? null;
    const activeCompany = activeMembership?.company ?? null;
    const effectiveRole = activeMembership
      ? resolveEffectiveRole({
          role: activeMembership.role,
          isOwner: activeMembership.isOwner,
        })
      : user.role;

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: activeCompany?.id ?? null,
    });

    const response = NextResponse.json({
      success: true,
      message: "Giriş başarılı.",
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
            }
          : null,
        redirectTo: getPostAuthRedirectPath(
          effectiveRole,
          activeMembership?.isOwner ?? false
        ),
      },
    });

    response.cookies.set("hesapisleri_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("LOGIN_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Giriş yapılırken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
