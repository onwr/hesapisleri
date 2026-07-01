import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/route-seo";

const PUBLIC_ROUTES = [
  "/",
  "/kvkk",
  "/kvkk-aydinlatma-metni",
  "/partner",
  "/partnership",
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
