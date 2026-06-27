import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ALLOWED_TAX_CERTIFICATE_MIME_TYPES,
  buildCustomerPayload,
  getCustomerTaxInfoStatus,
  hasCustomerTaxCertificate,
  isAllowedTaxCertificateMimeType,
  normalizeCustomerInput,
  normalizeTaxCertificateInput,
} from "./customer-form-utils";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

const MAX_BYTES = 5 * 1024 * 1024;

describe("customer tax fields", () => {
  it("normalizeCustomerInput taxOffice ve vergi levhası alanlarını saklar", () => {
    const normalized = normalizeCustomerInput(
      {
        name: "Örnek A.Ş.",
        taxOffice: " Battalgazi Vergi Dairesi ",
        taxCertificateUrl: "https://cdn.example/vergi.pdf",
        taxCertificateFileName: "vergi-levhasi.pdf",
        taxCertificateMimeType: "application/pdf",
        taxCertificateSize: 123456,
      },
      { maxTaxCertificateBytes: MAX_BYTES }
    );

    assert.equal(normalized.taxOffice, "Battalgazi Vergi Dairesi");
    assert.equal(normalized.taxCertificateUrl, "https://cdn.example/vergi.pdf");
    assert.equal(normalized.taxCertificateFileName, "vergi-levhasi.pdf");
    assert.equal(normalized.taxCertificateMimeType, "application/pdf");
    assert.equal(normalized.taxCertificateSize, 123456);
  });

  it("eski body ile create çalışır", () => {
    const normalized = normalizeCustomerInput(
      {
        name: "Bireysel Müşteri",
        phone: "0555",
      },
      { maxTaxCertificateBytes: MAX_BYTES }
    );

    assert.equal(normalized.name, "Bireysel Müşteri");
    assert.equal(normalized.taxOffice, null);
    assert.equal(normalized.taxCertificateUrl, null);
    assert.equal(normalized.group, "Genel");
  });

  it("invalid mime type reddedilir", () => {
    assert.throws(
      () =>
        normalizeTaxCertificateInput(
          {
            taxCertificateUrl: "https://cdn.example/file.exe",
            taxCertificateMimeType: "application/x-msdownload",
          },
          MAX_BYTES
        ),
      /desteklenmiyor/
    );
  });

  it("allowed mime types doğrulanır", () => {
    for (const mimeType of ALLOWED_TAX_CERTIFICATE_MIME_TYPES) {
      assert.equal(isAllowedTaxCertificateMimeType(mimeType), true);
    }
    assert.equal(isAllowedTaxCertificateMimeType("text/plain"), false);
  });

  it("buildCustomerPayload tax alanlarını taşır", () => {
    const payload = buildCustomerPayload({
      name: "Test",
      taxOffice: "Merkez VD",
      taxCertificateUrl: "https://cdn.example/a.pdf",
      taxCertificateFileName: "a.pdf",
      taxCertificateMimeType: "application/pdf",
      taxCertificateSize: 2048,
      group: "Genel",
    });

    assert.equal(payload.taxOffice, "Merkez VD");
    assert.equal(payload.taxCertificateUrl, "https://cdn.example/a.pdf");
    assert.equal(payload.taxCertificateSize, 2048);
  });

  it("hasCustomerTaxCertificate ve tax info status", () => {
    assert.equal(
      hasCustomerTaxCertificate({ taxCertificateUrl: "https://x" }),
      true
    );
    assert.equal(hasCustomerTaxCertificate({ taxCertificateUrl: null }), false);
    assert.equal(
      getCustomerTaxInfoStatus({
        taxOffice: "Merkez",
        taxCertificateUrl: "https://x",
      }),
      "complete"
    );
    assert.equal(getCustomerTaxInfoStatus({}), "missing");
    assert.equal(
      getCustomerTaxInfoStatus({ taxNo: "123", taxOffice: "Merkez" }),
      "partial"
    );
  });
});

describe("customer tax ui", () => {
  it("yeni müşteri formunda Vergi Bilgileri bölümü görünür", () => {
    const page = read("components/customers/new-customer-page.tsx");
    assert.match(page, /Vergi Bilgileri/);
    assert.match(page, /Vergi Dairesi/);
    assert.match(page, /CustomerTaxCertificateField/);
  });

  it("edit form mevcut vergi alanlarını kullanır", () => {
    const form = read("app/customers/[id]/edit/edit-customer-form.tsx");
    assert.match(form, /taxOffice/);
    assert.match(form, /CustomerTaxCertificateField/);
  });

  it("detail sayfasında vergi bilgileri görünür", () => {
    const page = read("app/customers/[id]/page.tsx");
    assert.match(page, /Vergi Dairesi/);
    assert.match(page, /Vergi levhası eklenmemiş/);
  });
});

describe("customer tax export", () => {
  it("CSV header vergi kolonlarını içerir", () => {
    const utils = read("lib/customer-export-utils.ts");
    assert.match(utils, /Vergi Dairesi/);
    assert.match(utils, /Vergi Levhası URL/);
  });
});
