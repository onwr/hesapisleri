import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { listMobileEmployees, createMobileEmployee } from "@/lib/mobile/mobile-employees-service";

export async function GET(request: Request) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);
    const url = new URL(request.url);
    const params = url.searchParams;
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "20");

    const data = await listMobileEmployees({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      filters: {
        search: params.get("search") ?? undefined,
        departmentId: params.get("departmentId") ?? undefined,
        employmentStatus: params.get("employmentStatus") ?? undefined,
        leaveStatus: params.get("leaveStatus") ?? undefined,
        isActive:
          params.get("isActive") === "true" ? true : params.get("isActive") === "false" ? false : undefined,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
        sort: params.get("sort") ?? undefined,
      },
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    const body = await request.json();

    const data = await createMobileEmployee({
      companyId,
      actorUserId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      body,
    });

    return mobileJson(data, 201);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
