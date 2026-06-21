import { NextResponse } from "next/server";
import { getOptionalAuthenticatedApiSession } from "@/lib/module-access";
import { getInvitePreview } from "@/lib/company-users-service";

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
    const authSession = await getOptionalAuthenticatedApiSession();

    if (authSession) {
      session = {
        userId: authSession.userId,
        email: authSession.user.email,
      };
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
