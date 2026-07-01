import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  createMobileCustomer,
  listMobileCustomers,
} from "@/lib/mobile/mobile-customers-service";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "customers", "read");

    const url = new URL(request.url);
    const balanceFilter = url.searchParams.get("balanceFilter");
    const data = await listMobileCustomers({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      balanceFilter:
        balanceFilter === "debtors" || balanceFilter === "receivables"
          ? balanceFilter
          : undefined,
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
    await requireMobilePermission(session, "customers", "write");

    const body = await request.json();
    const data = await createMobileCustomer({
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
