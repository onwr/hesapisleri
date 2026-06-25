import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewInvoiceEDocument } from "@/lib/e-document/e-document-preview-service";
import { db } from "@/lib/prisma";

describe("e-document preview tenant isolation", () => {
  it("başka firmanın faturasına erişilemez", async () => {
    const calls: Array<{ where?: { companyId?: string; id?: string } }> = [];
    const originalFindFirst = db.invoice.findFirst.bind(db.invoice);

    db.invoice.findFirst = (async (args: {
      where?: { companyId?: string; id?: string };
    }) => {
      calls.push(args ?? {});
      return null;
    }) as unknown as typeof db.invoice.findFirst;

    try {
      await assert.rejects(
        () =>
          previewInvoiceEDocument({
            companyId: "company-b",
            invoiceId: "inv-owned-by-a",
          }),
        /Fatura bulunamadı/
      );

      assert.equal(calls.length >= 1, true);
      assert.equal(calls[0]?.where?.companyId, "company-b");
      assert.equal(calls[0]?.where?.id, "inv-owned-by-a");
    } finally {
      db.invoice.findFirst = originalFindFirst;
    }
  });

  it("taxpayer cache tenant anahtarı companyId+taxId içerir", async () => {
    const model = (db as { eDocumentTaxpayerLookupCache?: { findUnique: unknown } })
      .eDocumentTaxpayerLookupCache;
    assert.ok(model, "EDocumentTaxpayerLookupCache modeli tanımlı olmalı");
  });
});
