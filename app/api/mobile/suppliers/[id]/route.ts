import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import {
  getMobileSupplierDetail,
  updateMobileSupplier,
} from "@/lib/mobile/mobile-suppliers-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);
    const { id } = await context.params;
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

    const data = await getMobileSupplierDetail({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      supplierId: id,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { membership, companyId, session } = await requireMobileCompanySession(request);
    const { id } = await context.params;
    const body = await request.json();

    const data = await updateMobileSupplier({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      supplierId: id,
      body,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
