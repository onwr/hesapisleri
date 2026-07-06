import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import {
  listMobileEmployeePayments,
  createMobileEmployeePayment,
} from "@/lib/mobile/mobile-employees-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);
    const { id } = await context.params;
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "20");

    const data = await listMobileEmployeePayments({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      employeeId: id,
      filters: {
        type: params.get("type") ?? undefined,
        status: params.get("status") ?? undefined,
        dateFrom: params.get("dateFrom") ?? undefined,
        dateTo: params.get("dateTo") ?? undefined,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
      },
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    const { id } = await context.params;
    const body = await request.json();

    const data = await createMobileEmployeePayment({
      companyId,
      actorUserId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      employeeId: id,
      body,
    });

    return mobileJson({ success: true, ...data }, 201);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
