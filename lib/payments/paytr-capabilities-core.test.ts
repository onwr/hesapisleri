import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPaytrCheckoutOptionsAllowed,
  normalizePaytrCheckoutOptions,
  resolveAutoRenewFromPaymentMetadata,
  resolvePaytrCapabilities,
} from "./paytr-capabilities-core";

describe("paytr capabilities", () => {
  it("iframe modunda kart saklama ve otomatik yenileme kapalıdır", () => {
    const caps = resolvePaytrCapabilities({
      integrationMode: "iframe",
      directApiEnabled: true,
      cardStorageEnabled: true,
      recurringEnabled: true,
      non3dEnabled: true,
    });

    assert.equal(caps.manualRenewalOnly, true);
    assert.equal(caps.autoRenewAvailable, false);
    assert.equal(caps.cardStorageAvailable, false);
    assert.equal(caps.renewalMode, "manual");
  });

  it("direct modda tüm yetkiler açıkken otomatik yenileme kullanılabilir", () => {
    const caps = resolvePaytrCapabilities({
      integrationMode: "direct",
      directApiEnabled: true,
      cardStorageEnabled: true,
      recurringEnabled: true,
      non3dEnabled: true,
    });

    assert.equal(caps.autoRenewAvailable, true);
    assert.equal(caps.manualRenewalOnly, false);
    assert.equal(caps.renewalMode, "automatic");
  });

  it("env bayrağı açık olsa bile recurring kapalıysa otomatik yenileme kapalı kalır", () => {
    const caps = resolvePaytrCapabilities({
      integrationMode: "direct",
      directApiEnabled: true,
      cardStorageEnabled: true,
      recurringEnabled: false,
      non3dEnabled: true,
    });

    assert.equal(caps.autoRenewAvailable, false);
    assert.throws(() =>
      assertPaytrCheckoutOptionsAllowed(caps, { autoRenew: true, saveCard: true })
    );
  });

  it("checkout seçenekleri kapalı modda sıfırlanır", () => {
    const caps = resolvePaytrCapabilities({
      integrationMode: "iframe",
      directApiEnabled: false,
      cardStorageEnabled: true,
      recurringEnabled: false,
      non3dEnabled: false,
    });

    assert.deepEqual(
      normalizePaytrCheckoutOptions(caps, { autoRenew: true, saveCard: true }),
      { autoRenew: false, saveCard: false }
    );
  });

  it("ödeme metadata autoRenew yalnız yetkili modda uygulanır", () => {
    const iframeCaps = resolvePaytrCapabilities({
      integrationMode: "iframe",
      directApiEnabled: true,
      cardStorageEnabled: true,
      recurringEnabled: true,
      non3dEnabled: true,
    });

    assert.equal(
      resolveAutoRenewFromPaymentMetadata(iframeCaps, {
        autoRenew: true,
        saveCard: true,
      }),
      false
    );

    const directCaps = resolvePaytrCapabilities({
      integrationMode: "direct",
      directApiEnabled: true,
      cardStorageEnabled: true,
      recurringEnabled: true,
      non3dEnabled: true,
    });

    assert.equal(
      resolveAutoRenewFromPaymentMetadata(directCaps, {
        autoRenew: true,
        saveCard: true,
      }),
      true
    );
    assert.equal(
      resolveAutoRenewFromPaymentMetadata(directCaps, {
        autoRenew: true,
        saveCard: false,
      }),
      false
    );
  });
});
