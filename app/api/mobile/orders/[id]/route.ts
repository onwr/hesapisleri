import { getMobileOrderDetail } from "@/lib/mobile/mobile-orders-service";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, companyId } = await requireMobilePosSession(request);
    await requireMobilePermission(session, "orders", "read");

    const { id } = await context.params;
    const data = await getMobileOrderDetail(companyId, id);
    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
