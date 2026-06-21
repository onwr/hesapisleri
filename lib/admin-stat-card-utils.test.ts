import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_STAT_TONE_CLASS,
  getAdminStatToneClass,
  shouldRenderStatChevron,
  shouldRenderStatIconWrapper,
} from "./admin-stat-card-utils";

describe("admin stat card utils", () => {
  it("tüm tone class değerlerini döndürür", () => {
    for (const tone of Object.keys(ADMIN_STAT_TONE_CLASS) as Array<
      keyof typeof ADMIN_STAT_TONE_CLASS
    >) {
      assert.match(getAdminStatToneClass(tone), /bg-/);
    }
  });

  it("href yoksa chevron render edilmez", () => {
    assert.equal(shouldRenderStatChevron(), false);
    assert.equal(shouldRenderStatChevron(""), false);
  });

  it("href varsa chevron render edilir", () => {
    assert.equal(shouldRenderStatChevron("/admin/companies"), true);
  });

  it("icon yoksa wrapper render edilmemeli", () => {
    assert.equal(shouldRenderStatIconWrapper(undefined), false);
    assert.equal(shouldRenderStatIconWrapper(null), false);
  });

  it("icon varsa wrapper render edilmeli", () => {
    assert.equal(shouldRenderStatIconWrapper(() => null), true);
  });
});
