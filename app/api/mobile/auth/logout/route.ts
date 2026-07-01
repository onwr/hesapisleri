import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileApiSession, mobileErrorResponse } from "@/lib/mobile/mobile-auth-guards";
import { revokeMobileSession, revokeMobileSessionById } from "@/lib/mobile/mobile-session-service";

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireMobileApiSession(req);

    const body = await req.json().catch(() => ({}));
    const parsed = logoutSchema.safeParse(body);

    // Refresh token ile revoke (öncelikli)
    if (parsed.success && parsed.data.refreshToken) {
      await revokeMobileSession(parsed.data.refreshToken);
    }

    // sid varsa access token session'ını da revoke et (logout sonrası access token anında geçersiz)
    if (session.sid) {
      await revokeMobileSessionById(session.sid);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof Error && "status" in err && "code" in err) {
      const e = err as unknown as { code: string; message: string; status: number };
      return mobileErrorResponse(e.code, e.message, e.status);
    }
    return NextResponse.json({ error: "Çıkış yapılırken hata oluştu." }, { status: 500 });
  }
}
