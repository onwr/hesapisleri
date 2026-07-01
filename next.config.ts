import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { securityHeaders } from "@/lib/security-headers";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const cdnHostname = (() => {
  try {
    return new URL(process.env.CDN_BASE_URL ?? "https://cdn.littlemomstore.com")
      .hostname;
  } catch {
    return "cdn.littlemomstore.com";
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["libxmljs2"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: cdnHostname,
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
