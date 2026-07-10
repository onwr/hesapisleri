process.env.NODE_ENV = "production";
process.env.APP_URL = process.env.APP_URL ?? "https://hesapisleri.com";

const input = JSON.parse(process.argv[2] ?? "{}");
const { verifyApiMutationOrigin } = await import("../lib/api-origin-guard.ts");

const headers = new Headers();
if (input.origin) headers.set("origin", input.origin);
if (input.referer) headers.set("referer", input.referer);

const req = new Request("http://localhost:3000/api/test", {
  method: input.method ?? "POST",
  headers,
});

const result = verifyApiMutationOrigin(req);
if (result === null) {
  console.log(JSON.stringify({ allowed: true }));
} else {
  console.log(JSON.stringify({ allowed: false, status: result.status }));
}
