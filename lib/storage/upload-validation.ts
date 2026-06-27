import { PLATFORM_SETTINGS_DEFAULTS } from "@/lib/admin/platform-settings/platform-settings-defaults";
import { formatMaxBytesMessage } from "@/lib/storage/upload-limit-utils";

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_TAX_CERTIFICATE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** @deprecated getPlatformRuntimeUploadLimits() kullanın */
export const MAX_IMAGE_BYTES = PLATFORM_SETTINGS_DEFAULTS.maxImageBytes;

/** @deprecated getPlatformRuntimeUploadLimits() kullanın */
export const MAX_TAX_CERTIFICATE_BYTES = PLATFORM_SETTINGS_DEFAULTS.maxTaxCertificateBytes;

export { formatMaxBytesMessage } from "@/lib/storage/upload-limit-utils";

export function validateImageFileWithLimits(file: File, maxBytes: number) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Sadece JPEG, PNG veya WebP yükleyebilirsiniz");
  }
  if (file.size > maxBytes) {
    throw new Error(formatMaxBytesMessage(maxBytes));
  }
}

export function validateTaxCertificateFileWithLimits(file: File, maxBytes: number) {
  if (!ALLOWED_TAX_CERTIFICATE_TYPES.has(file.type)) {
    throw new Error("Sadece PDF, JPEG, PNG veya WebP yükleyebilirsiniz");
  }
  if (file.size > maxBytes) {
    throw new Error(formatMaxBytesMessage(maxBytes));
  }
}

/** @deprecated validateImageFileWithLimits(file, maxBytes) kullanın */
export function validateImageFile(file: File) {
  validateImageFileWithLimits(file, MAX_IMAGE_BYTES);
}

/** @deprecated validateTaxCertificateFileWithLimits(file, maxBytes) kullanın */
export function validateTaxCertificateFile(file: File) {
  validateTaxCertificateFileWithLimits(file, MAX_TAX_CERTIFICATE_BYTES);
}
