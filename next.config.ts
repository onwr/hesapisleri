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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "form-action 'self' https://www.paytr.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
