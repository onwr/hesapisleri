const isProduction = process.env.NODE_ENV === "production";

// form-action: yalnız uygulama <form> POST gönderdiğinde veya bir ödeme
// sağlayıcısı bize form-POST ile geri döndüğünde gerekir.
// - PayTR iFrame form submit yapar → form-action'a paytr.com eklenmesi gerekir.
// - Sipay: SipayCheckoutButton window.location.assign kullanır (form-POST
//   YOK), return/cancel callback'leri de form-POST ile gelmez → form-action'a
//   sipay domain'i eklenmesi GEREKMEZ.
// PAYTR_ENABLED=false ise (yalnız Sipay aktifse) paytr.com CSP'den kaldırılır
// — kullanılmayan sağlayıcı domain'i CSP'de tutulmaz.
const paytrEnabled = process.env.PAYTR_ENABLED !== "false";

// unsafe-eval yalnız Next.js dev modunda (HMR/eval-source-map) gerekir —
// production bundle'ında hiçbir kod eval() veya new Function() kullanmıyor
// (kaynak tarandı: yalnız server-side Redis client.eval() var, bu Lua script
// çalıştırma metodu, tarayıcı eval() değil — CSP'yi ilgilendirmez).
// Production'da script-src'den KALDIRILDI.
const scriptSrc = isProduction
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

export const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  paytrEnabled ? "form-action 'self' https://www.paytr.com" : "form-action 'self'",
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
