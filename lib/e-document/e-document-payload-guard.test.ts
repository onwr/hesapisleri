import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEDocumentProviderPayloadIsolation,
  redactEDocumentValidationErrors,
} from "@/lib/e-document/e-document-payload-guard";

describe("e-document payload guard", () => {
  it("efinans alanlarını trendyol isteğinde reddeder", () => {
    assert.throws(
      () =>
        assertEDocumentProviderPayloadIsolation({
          provider: "TRENDYOL_EFATURAM",
          companyId: "c1",
          connectionMode: "DIRECT_ACCOUNT",
          environment: "STAGE",
          username: "wsadminuser",
        } as never),
      /Sovos veya eFinans bilgileri Trendyol/
    );
  });

  it("trendyol alanlarını efinans isteğinde reddeder", () => {
    assert.throws(
      () =>
        assertEDocumentProviderPayloadIsolation({
          provider: "EFINANS",
          companyId: "c1",
          username: "wsadminuser",
          companyCode: "TAM0000011",
          environment: "STAGE",
          email: "ornek@firma.com",
        } as never),
      /Trendyol veya Sovos bilgileri eFinans/
    );
  });

  it("sovos alanlarını trendyol isteğinde reddeder", () => {
    assert.throws(
      () =>
        assertEDocumentProviderPayloadIsolation({
          provider: "TRENDYOL_EFATURAM",
          companyId: "c1",
          connectionMode: "DIRECT_ACCOUNT",
          environment: "STAGE",
          taxId: "1234567890",
        } as never),
      /Sovos veya eFinans bilgileri Trendyol/
    );
  });

  it("trendyol alanlarını sovos isteğinde reddeder", () => {
    assert.throws(
      () =>
        assertEDocumentProviderPayloadIsolation({
          provider: "SOVOS",
          companyId: "c1",
          environment: "STAGE",
          taxId: "1234567890",
          useSameArchiveCredentials: true,
          email: "ornek@firma.com",
        } as never),
      /Trendyol veya eFinans bilgileri Sovos/
    );
  });

  it("doğrulama hatalarında hassas alanları maskele", () => {
    const redacted = redactEDocumentValidationErrors({
      formErrors: [],
      fieldErrors: {
        password: ["String must contain at least 1 character(s)"],
        prefix: ["Geçersiz önek"],
      },
    });

    assert.deepEqual(redacted.fieldErrors.password, ["Geçersiz değer."]);
    assert.deepEqual(redacted.fieldErrors.prefix, ["Geçersiz önek"]);
  });
});
