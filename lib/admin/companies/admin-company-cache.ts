import { revalidateTag } from "next/cache";

export function invalidateAdminCompanyCaches(companyId?: string) {
  revalidateTag("admin-company-list-metrics", "max");
  if (companyId) {
    revalidateTag(`admin-company-detail:${companyId}`, "max");
  }
}
