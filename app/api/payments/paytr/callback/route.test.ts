import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const source = readFileSync(join(process.cwd(), "app/api/payments/paytr/callback/route.ts"), "utf8");

describe("PayTR callback route", () => {
  it("public route node runtime ve force-dynamic kullanır", () => {
    assert.match(source, /runtime = "nodejs"/);
    assert.match(source, /dynamic = "force-dynamic"/);
  });

  it("başarılı response yalnız OK text döner", () => {
    assert.match(source, /new Response\("OK"/);
    assert.doesNotMatch(source, /NextResponse\.json\(\{\s*success: true/);
  });

  it("session veya tenant guard kullanmaz", () => {
    assert.doesNotMatch(source, /getAppSession|requireApi|requireTenant/);
  });
});
