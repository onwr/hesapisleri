import { NextResponse } from "next/server";
import { z } from "zod";
import { refreshMobileSession } from "@/lib/mobile/mobile-session-service";

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token zorunludur."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = refreshSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Refresh token zorunludur.", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { accessToken, refreshToken } = await refreshMobileSession(parsed.data.refreshToken);

    return NextResponse.json({ accessToken, refreshToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (message === "USER_SUSPENDED") {
      return NextResponse.json({ error: "Hesabınız askıya alınmıştır.", code: "SUSPENDED_USER" }, { status: 403 });
    }

    // INVALID_REFRESH_TOKEN, REFRESH_TOKEN_EXPIRED, SESSION_VERSION_MISMATCH
    return NextResponse.json({ error: "Oturum süresi doldu. Lütfen tekrar giriş yapın.", code: "SESSION_EXPIRED" }, { status: 401 });
  }
}
