import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getInvitePreview } from "@/lib/company-users-service";

type AuthPayload = {
  userId: string;
  email?: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Davet kodu gerekli." },
        { status: 400 }
      );
    }

    let session: { userId: string; email: string } | null = null;
    const authToken = await getAuthToken();

    if (authToken) {
      const payload = verifyToken<AuthPayload>(authToken);

      if (payload?.userId) {
        const user = await db.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, email: true },
        });

        if (user) {
          session = {
            userId: user.id,
            email: user.email,
          };
        }
      }
    }

    const preview = await getInvitePreview(token, session);

    if (!preview) {
      return NextResponse.json(
        { success: false, message: "Davet bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.error("INVITE_PREVIEW_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Davet bilgisi alınamadı." },
      { status: 500 }
    );
  }
}
