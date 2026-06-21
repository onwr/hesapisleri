import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  KVKK_AYDINLATMA_ACKNOWLEDGMENT_TEXT,
  KVKK_AYDINLATMA_LAST_UPDATED,
  KVKK_AYDINLATMA_VERSION,
  buildKvkkAcknowledgmentRecord,
} from "./kvkk-consent";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("register KVKK aydınlatma", () => {
  it("acknowledgment text is informational, not open consent", () => {
    assert.match(KVKK_AYDINLATMA_ACKNOWLEDGMENT_TEXT, /okudum ve bilgilendirildim/i);
    assert.doesNotMatch(KVKK_AYDINLATMA_ACKNOWLEDGMENT_TEXT, /kabul ediyorum/i);
    assert.doesNotMatch(KVKK_AYDINLATMA_ACKNOWLEDGMENT_TEXT, /onay veriyorum/i);
  });

  it("audit record includes version and display date", () => {
    const record = buildKvkkAcknowledgmentRecord();
    assert.match(record, new RegExp(KVKK_AYDINLATMA_VERSION));
    assert.match(record, new RegExp(KVKK_AYDINLATMA_LAST_UPDATED));
  });

  it("register API requires kvkkInformed and persists UserConsent", () => {
    const source = readFileSync(
      join(webRoot, "app/api/auth/register/route.ts"),
      "utf8"
    );
    assert.match(source, /kvkkInformed:\s*z\.literal\(true/);
    assert.match(source, /userConsent\.create/);
    assert.match(source, /type:\s*"KVKK"/);
    assert.match(source, /KVKK_AYDINLATMA_VERSION/);
    assert.match(source, /buildKvkkAcknowledgmentRecord/);
    assert.match(source, /MARKETING_ELECTRONIC/);
  });

  it("register form uses modal and separate marketing checkbox", () => {
    const source = readFileSync(
      join(webRoot, "components/register/register-form.tsx"),
      "utf8"
    );
    assert.match(source, /KvkkAydinlatmaModal/);
    assert.match(source, /kvkkInformed/);
    assert.match(source, /MARKETING_CONSENT_TEXT/);
    assert.match(source, /marketingConsent/);
  });

  it("public aydınlatma page exists", () => {
    const source = readFileSync(
      join(webRoot, "app/kvkk-aydinlatma-metni/page.tsx"),
      "utf8"
    );
    assert.match(source, /KvkkAydinlatmaContent/);
  });
});
