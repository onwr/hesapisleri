import { listMobileOrders } from "@/lib/mobile/mobile-orders-service";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";

export async function GET(request: Request) {
  try {
    const { session, companyId } = await requireMobilePosSession(request);
    await requireMobilePermission(session, "orders", "read");

    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "20");

    const data = await listMobileOrders(companyId, {
      search: params.get("search") ?? undefined,
      channel: params.get("channel") ?? undefined,
      status: params.get("status") ?? undefined,
      paymentStatus: params.get("paymentStatus") ?? undefined,
      customerId: params.get("customerId") ?? undefined,
      dateFrom: params.get("dateFrom") ?? undefined,
      dateTo: params.get("dateTo") ?? undefined,
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
      sort: params.get("sort") === "oldest" ? "oldest" : "newest",
    });

    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
