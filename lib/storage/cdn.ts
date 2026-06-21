/**
 * CDN Storage Service — resimleri uzak CDN (upload.php) üzerine yükler.
 */

import "server-only";

import { randomUUID } from "node:crypto";
import {
  ImageOptimizerError,
  optimizeUploadedImage,
} from "@/lib/uploads/image-optimizer";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_TAX_CERTIFICATE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_TAX_CERTIFICATE_BYTES,
  validateImageFile,
  validateTaxCertificateFile,
} from "@/lib/storage/upload-validation";

export { ImageOptimizerError } from "@/lib/uploads/image-optimizer";
export {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_TAX_CERTIFICATE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_TAX_CERTIFICATE_BYTES,
  validateImageFile,
  validateTaxCertificateFile,
} from "@/lib/storage/upload-validation";

export class StorageConfigError extends Error {
  constructor(message = "CDN yapılandırması eksik") {
    super(message);
    this.name = "StorageConfigError";
  }
}

export class StorageUploadError extends Error {
  constructor(message = "Görsel CDN'e yüklenemedi") {
    super(message);
    this.name = "StorageUploadError";
  }
}

function getCdnConfig() {
  const CDN_UPLOAD_URL = process.env.CDN_UPLOAD_URL;
  const CDN_UPLOAD_TOKEN = process.env.CDN_UPLOAD_TOKEN;
  const CDN_BASE_URL = process.env.CDN_BASE_URL;

  if (!CDN_UPLOAD_URL) {
    throw new StorageConfigError("CDN_UPLOAD_URL tanımlı değil");
  }

  return { CDN_UPLOAD_URL, CDN_UPLOAD_TOKEN, CDN_BASE_URL };
}

export function resolveCdnUrl(pathOrUrl: string, CDN_BASE_URL?: string) {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (!CDN_BASE_URL) return pathOrUrl;
  return `${CDN_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

async function uploadBufferToCdn(
  buffer: Buffer,
  mimeType: string,
  folder: string,
  fileName?: string
): Promise<string | null> {
  const { CDN_UPLOAD_URL, CDN_UPLOAD_TOKEN, CDN_BASE_URL } = getCdnConfig();

  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const name = fileName ?? `upload_${Date.now()}.${extension}`;

  const formData = new FormData();
  const file = new File([new Uint8Array(buffer)], name, { type: mimeType });

  formData.append("file", file);
  formData.append("token", CDN_UPLOAD_TOKEN ?? "");
  formData.append("folder", folder);

  const response = await fetch(CDN_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("CDN upload error status:", response.status, errorText);
    return null;
  }

  const result = (await response.json()) as { url?: string };

  if (result.url) {
    return resolveCdnUrl(result.url, CDN_BASE_URL);
  }

  console.error("CDN response missing URL:", result);
  return null;
}

export async function saveFileFromBuffer(
  buffer: Buffer,
  mimeType: string,
  folder: string,
  fileName?: string,
  options?: { skipOptimization?: boolean }
): Promise<string | null> {
  try {
    let uploadBuffer = buffer;
    let uploadMime = mimeType;
    let uploadName = fileName;

    if (!options?.skipOptimization && ALLOWED_IMAGE_TYPES.has(mimeType)) {
      try {
        const optimized = await optimizeUploadedImage(buffer);
        uploadBuffer = optimized.buffer;
        uploadMime = optimized.mimeType;
        uploadName = fileName?.replace(/\.[^.]+$/, ".webp") ?? `${randomUUID()}.webp`;
      } catch (error) {
        if (error instanceof ImageOptimizerError) {
          throw error;
        }
        throw new ImageOptimizerError("Görsel optimize edilemedi.");
      }
    }

    return await uploadBufferToCdn(
      uploadBuffer,
      uploadMime,
      folder,
      uploadName
    );
  } catch (error) {
    if (error instanceof StorageConfigError) throw error;
    if (error instanceof ImageOptimizerError) throw error;
    console.error("Storage save error:", error);
    return null;
  }
}

export async function saveFileFromWebFile(
  file: File,
  folder: string,
  fileName?: string
): Promise<string | null> {
  validateImageFile(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  return saveFileFromBuffer(buffer, file.type, folder, fileName);
}

export async function saveTaxCertificateFromWebFile(
  file: File,
  folder: string,
  fileName?: string
): Promise<string | null> {
  validateTaxCertificateFile(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  return saveFileFromBuffer(buffer, file.type, folder, fileName);
}

export async function saveFile(
  data: string,
  folder: string = "hesapisleri/general"
): Promise<string | null> {
  try {
    if (!data) return null;

    if (data.startsWith("http") && !data.includes("base64")) {
      return data;
    }

    const matches = data.match(/^data:([A-Za-z0-9+/.-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return data.startsWith("data:") ? null : data;
    }

    const type = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    if (!ALLOWED_IMAGE_TYPES.has(type)) {
      throw new Error("Sadece JPEG, PNG veya WebP yükleyebilirsiniz");
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new Error("Dosya boyutu 5MB'dan küçük olmalıdır");
    }

    const optimized = await optimizeUploadedImage(buffer);

    return await uploadBufferToCdn(
      optimized.buffer,
      optimized.mimeType,
      folder,
      `${randomUUID()}.webp`
    );
  } catch (error) {
    if (error instanceof StorageConfigError) throw error;
    console.error("Storage save error:", error);
    return null;
  }
}

/**
 * Form/API'den gelen görseli CDN URL'sine çevirir.
 * Zaten http(s) ise olduğu gibi döner; data URL ise CDN'e yükler.
 */
export async function resolveUploadedImageUrl(
  input: string | undefined | null,
  folder: string
): Promise<string | null> {
  if (!input?.trim()) return null;

  const trimmed = input.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("data:")) {
    const url = await saveFile(trimmed, folder);
    if (!url) {
      throw new StorageUploadError("Görsel CDN'e yüklenemedi");
    }
    return url;
  }

  return trimmed;
}

export async function deleteFile(fileUrl: string): Promise<void> {
  console.log("Delete requested for:", fileUrl);
}
