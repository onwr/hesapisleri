import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { listMobileEmployeePerformance } from "@/lib/mobile/mobile-employees-service";

/**
 * Yalnız GET — bu şemada EmployeePerformanceRecord otomatik/cron üretimi bir
 * satış-aktivite özetidir, manuel "performans kaydı" oluşturma canonical
 * olarak desteklenmiyor (web tarafı da yalnız GET sağlıyor). POST bilinçli
 * olarak eklenmedi — bkz. final rapor.
 */
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

    const data = await listMobileEmployeePerformance({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      employeeId: id,
      filters: {
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
