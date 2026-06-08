import type { NextConfig } from "next";

const cdnHostname = (() => {
  try {
    return new URL(process.env.CDN_BASE_URL ?? "https://cdn.littlemomstore.com")
      .hostname;
  } catch {
    return "cdn.littlemomstore.com";
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: cdnHostname,
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
