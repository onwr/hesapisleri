export const MAX_UPLOAD_PIXELS = 24_000_000;
export const MAX_ORIGINAL_IMAGE_BYTES = 8 * 1024 * 1024;

export type OptimizeUploadedImageOptions = {
  maxWidth?: number;
  quality?: number;
};

export type OptimizedImageResult = {
  buffer: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
  originalSizeBytes: number;
  compressionRatio: number;
};

export class ImageOptimizerError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ImageOptimizerError";
    this.status = status;
  }
}

async function loadSharp(): Promise<typeof import("sharp").default> {
  const { default: sharp } = await import("sharp");
  return sharp;
}

export async function optimizeUploadedImage(
  buffer: Buffer,
  options: OptimizeUploadedImageOptions = {}
): Promise<OptimizedImageResult> {
  const maxWidth = options.maxWidth ?? 800;
  const quality = options.quality ?? 80;
  const originalSizeBytes = buffer.length;

  if (originalSizeBytes > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new ImageOptimizerError("Dosya boyutu 8MB sınırını aşıyor.", 413);
  }

  const sharp = await loadSharp();
  let image = sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_UPLOAD_PIXELS,
  });

  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw new ImageOptimizerError("Geçersiz görsel dosyası.");
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageOptimizerError("Geçersiz görsel dosyası.");
  }

  const optimizedBuffer = await image
    .rotate()
    .resize({
      width: maxWidth,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({
      quality,
      effort: 4,
    })
    .toBuffer({ resolveWithObject: true });

  const width = optimizedBuffer.info.width;
  const height = optimizedBuffer.info.height;
  const sizeBytes = optimizedBuffer.data.length;

  return {
    buffer: optimizedBuffer.data,
    mimeType: "image/webp",
    width,
    height,
    sizeBytes,
    originalSizeBytes,
    compressionRatio:
      originalSizeBytes > 0
        ? Math.round((sizeBytes / originalSizeBytes) * 100) / 100
        : 1,
  };
}
