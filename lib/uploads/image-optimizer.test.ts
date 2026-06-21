import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  ImageOptimizerError,
  optimizeUploadedImage,
} from "./image-optimizer";

describe("image optimizer", () => {
  it("resizes large JPEG to max 800px WebP", async () => {
    const source = await sharp({
      create: {
        width: 3000,
        height: 1500,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await optimizeUploadedImage(source);

    assert.equal(result.mimeType, "image/webp");
    assert.ok(result.width <= 800);
    assert.ok(result.height <= 800);
    assert.ok(result.sizeBytes < source.length);
  });

  it("does not enlarge small images", async () => {
    const source = await sharp({
      create: {
        width: 500,
        height: 300,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeUploadedImage(source);
    assert.equal(result.width, 500);
    assert.equal(result.height, 300);
  });

  it("preserves PNG alpha channel", async () => {
    const source = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeUploadedImage(source);
    const meta = await sharp(result.buffer).metadata();
    assert.equal(meta.hasAlpha, true);
  });

  it("rejects invalid buffers", async () => {
    await assert.rejects(
      () => optimizeUploadedImage(Buffer.from("not-an-image")),
      ImageOptimizerError
    );
  });
});
