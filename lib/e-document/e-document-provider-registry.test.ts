import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getEDocumentProviderMeta,
  isEDocumentProviderConnectionReady,
} from "@/lib/e-document/e-document-provider-registry";
import { maskSecretUsername } from "@/lib/e-document/e-document-crypto";

describe("e-document providers", () => {
  it("trendyol sağlayıcısı bağlantıya hazır", () => {
    assert.equal(isEDocumentProviderConnectionReady("TRENDYOL_EFATURAM"), true);
  });

  it("efinans sağlayıcısı henüz hazır değil", () => {
    assert.equal(isEDocumentProviderConnectionReady("EFINANS"), false);
    assert.match(getEDocumentProviderMeta("EFINANS").label, /eFinans/i);
  });

  it("sovos sağlayıcısı bağlantı testine hazır", () => {
    assert.equal(isEDocumentProviderConnectionReady("SOVOS"), true);
    assert.match(getEDocumentProviderMeta("SOVOS").label, /Sovos/i);
  });

  it("kullanıcı adını maskeler", () => {
    assert.equal(maskSecretUsername("demo@firma.com"), "d***@firma.com");
  });
});
