import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldShowOnboardingAlert } from "./company-onboarding-utils";

describe("shouldShowOnboardingAlert", () => {
  it("varsayılan firma adında uyarı gösterir", () => {
    assert.equal(shouldShowOnboardingAlert({ name: "İşletmem" }), true);
  });

  it("vergi no olmasa da gerçek firma adında uyarı göstermez", () => {
    assert.equal(
      shouldShowOnboardingAlert({ name: "KÜRKAYA GROUP" }),
      false
    );
  });

  it("boş veya çok kısa firma adında uyarı gösterir", () => {
    assert.equal(shouldShowOnboardingAlert({ name: "" }), true);
    assert.equal(shouldShowOnboardingAlert({ name: "A" }), true);
  });
});
