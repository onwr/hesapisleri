import type { Metadata } from "next";

export const privateRouteMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export const publicSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  process.env.WEBSITE_URL?.replace(/\/$/, "") ??
  "https://hesapisleri.com";
