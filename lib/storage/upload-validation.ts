export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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

export const MAX_TAX_CERTIFICATE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Sadece JPEG, PNG veya WebP yükleyebilirsiniz");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Dosya boyutu 5MB'dan küçük olmalıdır");
  }
}

export function validateTaxCertificateFile(file: File) {
  if (!ALLOWED_TAX_CERTIFICATE_TYPES.has(file.type)) {
    throw new Error("Sadece PDF, JPEG, PNG veya WebP yükleyebilirsiniz");
  }
  if (file.size > MAX_TAX_CERTIFICATE_BYTES) {
    throw new Error("Dosya boyutu 5MB'dan küçük olmalıdır");
  }
}
