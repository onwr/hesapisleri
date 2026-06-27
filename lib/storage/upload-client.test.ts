import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateClientImageFile } from "./upload-client";
import { formatMaxBytesMessage } from "./upload-limit-utils";

function createFile(input: { type: string; size: number }) {
  const buffer = new Uint8Array(input.size);
  return new File([buffer], "test.jpg", { type: input.type });
}

describe("validateClientImageFile", () => {
  const limit = 6 * 1024 * 1024;

  it("jpeg png webp kabul eder", () => {
    assert.doesNotThrow(() =>
      validateClientImageFile(createFile({ type: "image/jpeg", size: 1024 }), limit)
    );
    assert.doesNotThrow(() =>
      validateClientImageFile(createFile({ type: "image/png", size: 1024 }), limit)
    );
    assert.doesNotThrow(() =>
      validateClientImageFile(createFile({ type: "image/webp", size: 1024 }), limit)
    );
  });

  it("desteklenmeyen tipi reddeder", () => {
    assert.throws(
      () => validateClientImageFile(createFile({ type: "application/pdf", size: 1024 }), limit),
      /yükleyebilirsiniz/
    );
  });

  it("limit üzeri dosyayı gerçek MB ile reddeder", () => {
    assert.throws(
      () =>
        validateClientImageFile(
          createFile({ type: "image/jpeg", size: limit + 1 }),
          limit
        ),
      new RegExp(formatMaxBytesMessage(limit).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  });
});
