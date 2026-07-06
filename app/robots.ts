import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/route-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/cash-bank",
        "/settings",
        "/api/",
        "/login",
        "/register",
        "/onboarding",
        "/partner",
        "/partnership",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: `${publicSiteUrl}/sitemap.xml`,
  };
}
