import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSovosCapabilitiesFromInput,
  buildSovosCapabilitiesFromTestOutcomes,
  DEFAULT_SOVOS_CAPABILITIES,
  parseSovosCapabilities,
} from "@/lib/e-document/sovos-capabilities";

describe("sovos capabilities", () => {
  it("varsayılan capability değerleri doğrulanmamış", () => {
    assert.equal(DEFAULT_SOVOS_CAPABILITIES.eInvoice.verified, false);
    assert.equal(DEFAULT_SOVOS_CAPABILITIES.eInvoice.contractReady, false);
    assert.equal(DEFAULT_SOVOS_CAPABILITIES.taxpayerLookup, false);
  });

  it("credential varlığına göre configured işaretler", () => {
    const capabilities = buildSovosCapabilitiesFromInput({
      hasInvoiceCredentials: true,
      hasArchiveCredentials: false,
    });
    assert.equal(capabilities.eInvoice.configured, true);
    assert.equal(capabilities.eInvoice.verified, false);
    assert.equal(capabilities.eInvoice.contractReady, true);
    assert.equal(capabilities.eArchive.configured, false);
  });

  it("gerçek provider testi verified işaretler", () => {
    const capabilities = buildSovosCapabilitiesFromTestOutcomes({
      credentials: {
        hasInvoiceCredentials: true,
        hasArchiveCredentials: false,
        hasDespatchCredentials: false,
      },
      outcomes: [{ service: "eInvoice", ok: true, skipped: false }],
      verificationMode: "real",
    });
    assert.equal(capabilities.eInvoice.verified, true);
    assert.equal(capabilities.eInvoice.mockTested, false);
    assert.equal(capabilities.taxpayerLookup, true);
  });

  it("json capability parse eder", () => {
    const parsed = parseSovosCapabilities({
      eInvoice: { configured: true, contractReady: true, mockTested: false, verified: false },
      eArchive: { configured: true, contractReady: true, mockTested: false, verified: true },
      eDespatch: { configured: false, contractReady: true, mockTested: false, verified: false },
      taxpayerLookup: true,
      invoiceDownload: false,
      archiveCancel: false,
      archiveRetrigger: false,
    });
    assert.equal(parsed.eArchive.verified, true);
    assert.equal(parsed.taxpayerLookup, true);
  });
});
