import { NextResponse } from "next/server";
import { posCheckoutSchema } from "@/lib/pos-checkout-utils";
import { executeMobilePosCheckout } from "@/lib/mobile/mobile-pos-service";
import { mapPosCheckoutError, MobilePosError } from "@/lib/mobile/mobile-pos-errors";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";

export async function POST(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobilePosSession(request);

    const body = await request.json();
    const parsed = posCheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Bilgileri kontrol edin.",
          code: "VALIDATION_ERROR",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    try {
      const result = await executeMobilePosCheckout({
        companyId,
        userId: session.userId,
        role: membership.role,
        isOwner: membership.isOwner,
        data: parsed.data,
      });
      return mobilePosJson(result);
    } catch (error) {
      const mapped = mapPosCheckoutError(error);
      if (mapped) {
        return NextResponse.json(
          { error: mapped.message, code: mapped.code },
          { status: mapped.status }
        );
      }
      if (error instanceof MobilePosError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status }
        );
      }
      throw error;
    }
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
