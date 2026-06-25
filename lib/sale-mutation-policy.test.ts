import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getInvoiceEDocumentBlockMessage,
  validateSaleCancelEligibility,
  validateSaleEditEligibility,
} from "@/lib/sale-mutation-policy";

function baseSale(overrides: Record<string, unknown> = {}) {
  return {
    id: "sale-1",
    status: "COMPLETED",
    saleNo: "S-001",
    invoice: null,
    ...overrides,
  };
}

describe("sale mutation policy", () => {
  it("iptal edilmiş satış düzenlenemez", () => {
    const result = validateSaleEditEligibility(
      baseSale({ status: "CANCELLED" }) as never
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "ALREADY_CANCELLED");
    }
  });

  it("iade kaydı olan satış düzenlenemez", () => {
    const result = validateSaleEditEligibility(
      baseSale({ status: "REFUNDED" }) as never
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "HAS_REFUND_RECORD");
    }
  });

  it("taslak satış düzenlenemez", () => {
    const result = validateSaleEditEligibility(
      baseSale({ status: "DRAFT" }) as never
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "NOT_EDITABLE_STATUS");
    }
  });

  it("onaylı e-belge olan satış düzenlenemez", () => {
    const result = validateSaleEditEligibility(
      baseSale({
        invoice: { status: "APPROVED", paymentStatus: "UNPAID", paidAmount: 0 },
      }) as never
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "E_DOCUMENT_LOCKED");
    }
  });

  it("tahsil edilmiş faturası olan satış düzenlenemez", () => {
    const result = validateSaleEditEligibility(
      baseSale({
        invoice: {
          status: "DRAFT",
          paymentStatus: "PARTIAL",
          paidAmount: 50,
          documentSubmission: null,
        },
      }) as never
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "INVOICE_COLLECTED");
    }
  });

  it("tamamlanmış ve uygun satış düzenlenebilir", () => {
    const result = validateSaleEditEligibility(baseSale() as never);
    assert.equal(result.ok, true);
  });

  it("iptal edilmiş satış tekrar iptal edilemez", () => {
    const result = validateSaleCancelEligibility(
      baseSale({ status: "CANCELLED" }) as never
    );
    assert.equal(result.ok, false);
  });

  it("gönderilmiş fatura olan satış iptal edilemez", () => {
    const message = getInvoiceEDocumentBlockMessage({
      status: "SENT",
      documentSubmission: null,
    } as never);
    assert.ok(message);

    const result = validateSaleCancelEligibility(
      baseSale({
        invoice: { status: "SENT", documentSubmission: null },
      }) as never
    );
    assert.equal(result.ok, false);
  });

  it("tamamlanmış satış iptal edilebilir", () => {
    const result = validateSaleCancelEligibility(baseSale() as never);
    assert.equal(result.ok, true);
  });
});
