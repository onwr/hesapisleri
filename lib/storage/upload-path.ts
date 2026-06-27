const DEFAULT_SUBFOLDER = "general";

/** CUID / UUID benzeri segmentleri (başka tenant id enjeksiyonu) reddeder. */
function looksLikeForeignTenantId(segment: string, sessionCompanyId: string) {
  if (segment === sessionCompanyId) return false;
  return /^[a-z0-9]{20,}$/i.test(segment);
}

/**
 * CDN yükleme klasörünü oturum companyId ile sabitler.
 * İstemci folder değeri yalnızca alt klasör adı olarak kullanılır.
 */
export function resolveTenantUploadFolder(
  sessionCompanyId: string,
  requestedFolder?: string | null
): string {
  const raw = (requestedFolder ?? `hesapisleri/${DEFAULT_SUBFOLDER}`).trim();
  const safe = raw.replace(/[^a-zA-Z0-9/_-]/g, "");

  const segments = safe.split("/").filter(Boolean);
  const subfolderSegments = segments.filter((segment) => {
    if (segment === "hesapisleri") return false;
    if (segment === sessionCompanyId) return false;
    if (looksLikeForeignTenantId(segment, sessionCompanyId)) return false;
    return true;
  });

  const subfolder = subfolderSegments.join("/") || DEFAULT_SUBFOLDER;
  return `hesapisleri/${sessionCompanyId}/${subfolder}`;
}
