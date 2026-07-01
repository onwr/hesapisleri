const isProduction = process.env.NODE_ENV === "production";

export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  // form-action: yalnız uygulama <form> POST gönderdiğinde gerekir.
  // PayTR iFrame form submit yapar → form-action'a eklendi.
  // Sipay: SipayCheckoutButton window.location.assign kullanır → form-action'a GEREK YOK.
  // Sipay return/cancel callback'leri Sipay'den form-POST ile gelir → uygulama almak için form-action gerekmez.
  "form-action 'self' https://www.paytr.com",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
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
