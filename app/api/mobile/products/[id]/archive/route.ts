import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { archiveMobileProduct } from "@/lib/mobile/mobile-products-service";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "write");
    const { id } = await params;

    const data = await archiveMobileProduct({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      productId: id,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
