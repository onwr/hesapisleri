process.env.NODE_ENV = "production";

const nextConfig = (await import("../next.config.ts")).default;
const rules = await nextConfig.headers();
const map = new Map((rules[0]?.headers ?? []).map((h) => [h.key, h.value]));

console.log(
  JSON.stringify({
    csp: map.get("Content-Security-Policy"),
    hsts: map.get("Strict-Transport-Security"),
  })
);
