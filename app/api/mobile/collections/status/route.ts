import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { getMobileCollectionStatus } from "@/lib/mobile/mobile-collections-service";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "invoices", "read");
    const url = new URL(request.url);
    const idempotencyKey = url.searchParams.get("idempotencyKey");
    if (!idempotencyKey) {
      return mobileJson({ status: "NOT_FOUND" });
    }
    const data = await getMobileCollectionStatus({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      idempotencyKey,
      payloadHash: url.searchParams.get("payloadHash") ?? undefined,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
