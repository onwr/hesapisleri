import { getMobilePosCheckoutStatus, requireMobilePosSellAccess } from "@/lib/mobile/mobile-pos-service";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";
import { MobilePosError } from "@/lib/mobile/mobile-pos-errors";
import { validatePosIdempotencyKey } from "@/lib/pos-checkout-idempotency";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobilePosSession(request);
    await requireMobilePosSellAccess(session, membership);

    const url = new URL(request.url);
    const idempotencyKey = url.searchParams.get("idempotencyKey") ?? "";
    const payloadHash = url.searchParams.get("payloadHash");

    const keyError = validatePosIdempotencyKey(idempotencyKey);
    if (keyError) {
      throw new MobilePosError("VALIDATION_ERROR", keyError, 400);
    }

    const data = await getMobilePosCheckoutStatus(
      companyId,
      idempotencyKey,
      payloadHash
    );
    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
