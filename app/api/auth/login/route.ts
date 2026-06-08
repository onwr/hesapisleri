import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
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

    const { email, password } = parsed.data;

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

    const activeCompany = user.companyUsers[0]?.company ?? null;

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
