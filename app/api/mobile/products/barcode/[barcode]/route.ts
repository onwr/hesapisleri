import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { findMobileProductByBarcode } from "@/lib/mobile/mobile-products-service";

type Props = { params: Promise<{ barcode: string }> };

export async function GET(request: Request, { params }: Props) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "read");
    const { barcode } = await params;

    const data = await findMobileProductByBarcode({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      barcode: decodeURIComponent(barcode),
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
