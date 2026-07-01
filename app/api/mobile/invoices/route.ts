import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  createMobileInvoice,
  listMobileInvoices,
} from "@/lib/mobile/mobile-invoices-service";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "invoices", "read");
    const url = new URL(request.url);
    const data = await listMobileInvoices({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      q: url.searchParams.get("q") ?? undefined,
      customerId: url.searchParams.get("customerId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
      overdue: url.searchParams.get("overdue") === "1",
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
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
    await requireMobilePermission(session, "invoices", "write");
    const body = await request.json();
    const data = await createMobileInvoice({
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
