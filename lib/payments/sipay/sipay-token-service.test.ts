import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { assertBrandedCheckoutSupported, _clearSipayTokenCache } from "./sipay-token-service";
import { IS3D_CAPABILITY } from "./sipay-types";
import { SipayCapabilityError } from "./sipay-errors";

describe("assertBrandedCheckoutSupported", () => {
  it("is_3d=0 (UNSUPPORTED) → SipayCapabilityError fırlatır", () => {
    assert.throws(
      () => assertBrandedCheckoutSupported(IS3D_CAPABILITY.UNSUPPORTED),
      SipayCapabilityError,
    );
  });

  it("is_3d=4 (BRANDED) → hata fırlatmaz", () => {
    assert.doesNotThrow(() => assertBrandedCheckoutSupported(IS3D_CAPABILITY.BRANDED));
  });

  it("is_3d=1 (THREE_D_OR_2D) → hata fırlatmaz", () => {
    assert.doesNotThrow(() => assertBrandedCheckoutSupported(IS3D_CAPABILITY.THREE_D_OR_2D));
  });

  it("is_3d=2 (THREE_D_ONLY) → hata fırlatmaz", () => {
    assert.doesNotThrow(() => assertBrandedCheckoutSupported(IS3D_CAPABILITY.THREE_D_ONLY));
  });
});

describe("_clearSipayTokenCache", () => {
  beforeEach(() => _clearSipayTokenCache());

  it("çift çağrı güvenlidir", () => {
    _clearSipayTokenCache();
    _clearSipayTokenCache();
  });
});
