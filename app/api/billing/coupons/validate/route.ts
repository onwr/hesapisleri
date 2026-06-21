import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import { validateCouponForCompany } from "@/lib/admin/promotions";
import {
  buildCouponValidateRateLimitKey,
  checkRateLimit,
} from "@/lib/rate-limit";

const schema = z.object({
  code: z.string().min(2).max(40),
  planId: z.string().min(1),
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
});

const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  try {
    const session = await getAppSession();
    if (
      !canManageMembership(session.effectiveRole, session.companyUser.isOwner)
    ) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip");

    const rate = checkRateLimit({
      key: buildCouponValidateRateLimitKey({
        userId: session.user.id,
        companyId: session.company.id,
        ip,
      }),
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    });

    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Çok fazla kupon denemesi yaptınız. Lütfen kısa bir süre sonra tekrar deneyin.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        }
      );
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz kupon isteği." },
        { status: 400 }
      );
    }

    const result = await validateCouponForCompany({
      companyId: session.company.id,
      code: parsed.data.code,
      planId: parsed.data.planId,
      billingInterval: parsed.data.billingInterval,
    });

    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json(
      { success: false, message: "Kupon doğrulanamadı." },
      { status: 500 }
    );
  }
}
