import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  createMobileExpense,
  listMobileExpenses,
} from "@/lib/mobile/mobile-expenses-service";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "expenses", "read");
    const url = new URL(request.url);
    const data = await listMobileExpenses({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      overdue: url.searchParams.get("overdue") === "1",
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
    await requireMobilePermission(session, "expenses", "write");
    const body = await request.json();
    const data = await createMobileExpense({
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
