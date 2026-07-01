import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  createMobileProduct,
  listMobileProducts,
} from "@/lib/mobile/mobile-products-service";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "read");

    const url = new URL(request.url);
    const data = await listMobileProducts({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      productType: url.searchParams.get("productType") ?? undefined,
      lowStock: url.searchParams.get("lowStock") === "true",
      hasBarcode:
        url.searchParams.get("hasBarcode") === "true"
          ? true
          : url.searchParams.get("hasBarcode") === "false"
            ? false
            : undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "write");

    const body = await request.json();
    const data = await createMobileProduct({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      body,
    });

    return mobileJson(data, 201);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
