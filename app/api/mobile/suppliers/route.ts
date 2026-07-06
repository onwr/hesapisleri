import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import {
  listMobileSuppliers,
  listMobileSuppliersFull,
  createMobileSupplier,
} from "@/lib/mobile/mobile-suppliers-service";

export async function GET(request: Request) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);
    const url = new URL(request.url);

    // Geriye dönük uyumluluk: view=full verilmediği sürece expense formundaki
    // tedarikçi seçici (picker) DAVRANIŞI DEĞİŞMEDEN aynı cursor-tabanlı DTO'yu
    // döner. Mobil Tedarikçiler ekranı view=full ile tam liste/summary'i çağırır.
    if (url.searchParams.get("view") === "full") {
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("pageSize") ?? "24");
      const data = await listMobileSuppliersFull({
        companyId,
        role: membership.role,
        isOwner: membership.isOwner,
        filters: {
          search: url.searchParams.get("search") ?? undefined,
          balanceStatus: url.searchParams.get("balanceStatus") ?? undefined,
          favorite: url.searchParams.get("favorite") === "true" ? true : undefined,
          hasDebt: url.searchParams.get("hasDebt") === "true" ? true : undefined,
          hasProducts:
            url.searchParams.get("hasProducts") === "true"
              ? true
              : url.searchParams.get("hasProducts") === "false"
                ? false
                : undefined,
          page: Number.isFinite(page) && page > 0 ? page : 1,
          pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 24,
          sort: url.searchParams.get("sort") ?? undefined,
        },
      });
      return mobileJson(data);
    }

    const data = await listMobileSuppliers({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      q: url.searchParams.get("q") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { membership, companyId, session } = await requireMobileCompanySession(request);
    const body = await request.json();

    const data = await createMobileSupplier({
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
