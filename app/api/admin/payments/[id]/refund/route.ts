import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { refundMembershipPayment } from "@/lib/payments/payment-refund-service";

type RouteParams = { params: Promise<{ id: string }> };

const schema = z.object({
  amountMinor: z.number().int().positive(),
  reason: z.string().min(3).max(500),
  accessAction: z
    .enum(["KEEP_UNTIL_PERIOD_END", "END_NOW", "MANUAL_REVIEW"])
    .default("MANUAL_REVIEW"),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "İade bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id } = await params;
    const result = await refundMembershipPayment({
      paymentId: id,
      amountMinor: parsed.data.amountMinor,
      reason: `${parsed.data.reason} (${parsed.data.accessAction})`,
      requestedByUserId: auth.user.id,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "İade başlatılamadı.",
      },
      { status: 500 }
    );
  }
}
