import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  getMobileProductById,
  updateMobileProduct,
} from "@/lib/mobile/mobile-products-service";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "read");
    const { id } = await params;

    const data = await getMobileProductById({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      productId: id,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "write");
    const { id } = await params;

    const body = await request.json();
    const data = await updateMobileProduct({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      productId: id,
      body,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
