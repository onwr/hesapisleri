import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export type SuperAdminSession = {
  user: User;
};

export class SuperAdminAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "SuperAdminAccessError";
    this.status = status;
  }
}

export async function getSuperAdminUser(): Promise<User | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || user.role !== "SUPER_ADMIN" || user.status !== "ACTIVE") {
    return null;
  }

  return user;
}

export async function getSuperAdminSession(): Promise<SuperAdminSession> {
  const user = await getSuperAdminUser();
  if (!user) {
    redirect("/unauthorized");
  }

  return { user };
}

export async function requireSuperAdminApi() {
  const token = await getAuthToken();

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      ),
    };
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Kullanıcı bulunamadı." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { success: false, message: "Bu işlem için Super Admin yetkisi gerekir." },
        { status: 403 }
      ),
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      error: NextResponse.json(
        { success: false, message: "Hesabınız aktif değil." },
        { status: 403 }
      ),
    };
  }

  return { user };
}
