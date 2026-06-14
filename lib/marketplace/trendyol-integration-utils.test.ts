import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTrendyolBasicAuth,
  isIntegrationValidationError,
  resolveTrendyolCredentials,
  storedCredentialTestFailureMessage,
  trendyolRequiresFreshSecrets,
} from "./trendyol-integration-utils";

describe("trendyol integration credentials", () => {
  it("ERROR durumunda secret boş bırakılırsa reddeder", () => {
    assert.throws(
      () =>
        resolveTrendyolCredentials(
          { supplierId: "649347" },
          { supplierId: "649347", apiKey: "old-key", apiSecret: "old-secret" },
          { requireFreshSecrets: true }
        ),
      /API Key ve API Secret alanlarını yeniden girmeniz gerekir/
    );
  });

  it("CONNECTED durumunda secret boş bırakılırsa eski secret korunur", () => {
    const creds = resolveTrendyolCredentials(
      { supplierId: "649347" },
      { supplierId: "649347", apiKey: "old-key", apiSecret: "old-secret" },
      { requireFreshSecrets: false }
    );
    assert.equal(creds.apiKey, "old-key");
    assert.equal(creds.apiSecret, "old-secret");
  });

  it("ERROR durumunda yeni secret girilirse kabul eder", () => {
    const creds = resolveTrendyolCredentials(
      {
        supplierId: "649347",
        apiKey: "new-key",
        apiSecret: "new-secret",
      },
      { supplierId: "649347", apiKey: "old-key", apiSecret: "old-secret" },
      { requireFreshSecrets: true }
    );
    assert.equal(creds.apiKey, "new-key");
    assert.equal(creds.apiSecret, "new-secret");
  });

  it("ilk kayıtta fresh secret zorunludur", () => {
    assert.equal(
      trendyolRequiresFreshSecrets({ hasStoredCredentials: false }),
      true
    );
    assert.equal(
      trendyolRequiresFreshSecrets({
        hasStoredCredentials: true,
        status: "ERROR",
      }),
      true
    );
    assert.equal(
      trendyolRequiresFreshSecrets({
        hasStoredCredentials: true,
        status: "CONNECTED",
      }),
      false
    );
  });

  it("stored credential test failure mesajını zenginleştirir", () => {
    const message = storedCredentialTestFailureMessage(
      "API bilgileri hatalı veya yetkisiz."
    );
    assert.match(message, /Kayıtlı credential geçersiz olabilir/);
  });

  it("validation hata mesajlarını algılar", () => {
    assert.equal(
      isIntegrationValidationError(
        "Trendyol bağlantı hatası nedeniyle API Key ve API Secret alanlarını yeniden girmeniz gerekir."
      ),
      true
    );
    assert.equal(isIntegrationValidationError("Trendyol satıcı numarası zorunludur."), true);
    assert.equal(isIntegrationValidationError("Entegrasyon bilgileri eksik."), true);
    assert.equal(isIntegrationValidationError("Geçersiz kanal."), true);
    assert.equal(isIntegrationValidationError("API bilgileri hatalı veya yetkisiz."), false);
  });
});

describe("trendyol basic auth", () => {
  it("apiKey:apiSecret base64 üretir", () => {
    const encoded = buildTrendyolBasicAuth({
      supplierId: "649347",
      apiKey: "key",
      apiSecret: "secret",
    });
    assert.equal(encoded, Buffer.from("key:secret").toString("base64"));
  });
});
