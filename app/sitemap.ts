import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/route-seo";

// /partner ve /partnership BURADA YOK: ikisi de girişe zorunlu, herkese açık
// içerikleri yok — anonim ziyaretçi/arama motoru botu her zaman giriş
// sayfasına yönlendiriliyor. Sitemap'te tutmak crawler'ların "içerik yerine
// yönlendirme" görmesine neden oluyordu (QA raporunda 500/güvenilirlik
// sorunu olarak işaretlenmişti).
const PUBLIC_ROUTES = [
  "/",
  "/kvkk",
  "/kvkk-aydinlatma-metni",
  "/privacy",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((path) => ({
    url: `${publicSiteUrl}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
