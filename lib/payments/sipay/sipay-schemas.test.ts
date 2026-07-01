import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sipayPurchaseLinkSuccessSchema,
  sipayPurchaseLinkErrorSchema,
} from "./sipay-schemas";

describe("sipay-schemas — purchase/link", () => {
  it("success response status_description olmadan parse edilir", () => {
    const parsed = sipayPurchaseLinkSuccessSchema.safeParse({
      status: true,
      status_code: 100,
      success_message: "İşlem başarılı",
      link: "https://provisioning.sipay.com.tr/pay/INV-001",
      order_id: "ORD-001",
    });

    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.status_code, 100);
    assert.equal(parsed.data.link, "https://provisioning.sipay.com.tr/pay/INV-001");
    assert.equal(parsed.data.order_id, "ORD-001");
    assert.equal(parsed.data.status_description, undefined);
  });

  it("error response status_description ile parse edilir", () => {
    const parsed = sipayPurchaseLinkErrorSchema.safeParse({
      status: false,
      status_code: 400,
      status_description: "Geçersiz hash",
    });

    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.status_code, 400);
    assert.equal(parsed.data.status_description, "Geçersiz hash");
  });
});
