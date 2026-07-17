import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMarketplaceFeatureEnabled,
  parseFeatureFlag,
} from "./marketplace-feature";

describe("marketplace feature flag", () => {
  it("default false when unset", () => {
    assert.equal(isMarketplaceFeatureEnabled({}), false);
    assert.equal(
      isMarketplaceFeatureEnabled({ MARKETPLACE_FEATURE_ENABLED: "" }),
      false
    );
  });

  it("true for common truthy values", () => {
    assert.equal(parseFeatureFlag("true"), true);
    assert.equal(parseFeatureFlag("1"), true);
    assert.equal(parseFeatureFlag("YES"), true);
    assert.equal(parseFeatureFlag("on"), true);
  });

  it("false for other values", () => {
    assert.equal(parseFeatureFlag("false"), false);
    assert.equal(parseFeatureFlag("0"), false);
    assert.equal(parseFeatureFlag("no"), false);
  });

  it("server false wins over NEXT_PUBLIC true", () => {
    assert.equal(
      isMarketplaceFeatureEnabled({
        MARKETPLACE_FEATURE_ENABLED: "false",
        NEXT_PUBLIC_MARKETPLACE_FEATURE_ENABLED: "true",
      }),
      false
    );
  });

  it("server true enables even if NEXT_PUBLIC unset", () => {
    assert.equal(
      isMarketplaceFeatureEnabled({ MARKETPLACE_FEATURE_ENABLED: "true" }),
      true
    );
  });

  it("NEXT_PUBLIC used only when server flag unset", () => {
    assert.equal(
      isMarketplaceFeatureEnabled({
        NEXT_PUBLIC_MARKETPLACE_FEATURE_ENABLED: "true",
      }),
      true
    );
  });
});
