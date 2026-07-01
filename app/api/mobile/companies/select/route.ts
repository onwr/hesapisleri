import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileApiSession, requireMobileCompanyContext, mobileErrorResponse, MobileAuthError } from "@/lib/mobile/mobile-auth-guards";
import { signMobileAccessToken } from "@/lib/mobile/mobile-jwt";
import { db } from "@/lib/prisma";

const selectSchema = z.object({
  companyId: z.string().min(1, "Firma ID zorunludur."),
});

export async function POST(req: Request) {
  try {
    const session = await requireMobileApiSession(req);

    const body = await req.json();
    const parsed = selectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz firma ID." }, { status: 400 });
    }

    const { companyId } = parsed.data;

    // Verify actual membership — never trust body companyId alone
    const context = await requireMobileCompanyContext(session, companyId);

    // Re-read current sessionVersion
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { sessionVersion: true },
    });

    const accessToken = signMobileAccessToken({
      userId: session.userId,
      email: session.email,
      role: session.role,
      companyId,
      sv: user?.sessionVersion ?? session.sv,
      sid: session.sid, // mevcut session id'yi koru
    });

    return NextResponse.json({
      accessToken,
      company: {
        companyId: context.company.id,
        companyName: context.company.name,
        role: context.role,
        isOwner: context.isOwner,
        companyStatus: context.company.status,
      },
    });
  } catch (err: unknown) {
    if (err instanceof MobileAuthError) {
      return mobileErrorResponse(err.code, err.message, err.status);
    }
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
