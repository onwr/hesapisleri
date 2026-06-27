import type { NextConfig } from "next";

const cdnHostname = (() => {
  try {
    return new URL(process.env.CDN_BASE_URL ?? "https://cdn.littlemomstore.com")
      .hostname;
  } catch {
    return "cdn.littlemomstore.com";
  }   
})();

const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "form-action 'self' https://www.paytr.com;",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

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

export default nextConfig;
