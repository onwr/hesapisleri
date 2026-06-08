import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateClientImageFile } from "./upload-client";

function createFile(input: { type: string; size: number }) {
  const buffer = new Uint8Array(input.size);
  return new File([buffer], "test-image", { type: input.type });
}

describe("validateClientImageFile", () => {
  it("JPEG dosyasını kabul eder", () => {
    assert.doesNotThrow(() =>
      validateClientImageFile(createFile({ type: "image/jpeg", size: 1024 }))
    );
  });

  it("PNG dosyasını kabul eder", () => {
    assert.doesNotThrow(() =>
      validateClientImageFile(createFile({ type: "image/png", size: 1024 }))
    );
  });

  it("WebP dosyasını kabul eder", () => {
    assert.doesNotThrow(() =>
      validateClientImageFile(createFile({ type: "image/webp", size: 1024 }))
    );
  });

  it("desteklenmeyen türü reddeder", () => {
    assert.throws(
      () =>
        validateClientImageFile(
          createFile({ type: "image/gif", size: 1024 })
        ),
      /JPEG, PNG veya WebP/
    );
  });

  it("5MB üzeri dosyayı reddeder", () => {
    assert.throws(
      () =>
        validateClientImageFile(
          createFile({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })
        ),
      /5MB/
    );
  });
});
