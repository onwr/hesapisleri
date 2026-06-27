import { validateImageFileWithLimits } from "@/lib/storage/upload-validation";

export const PRODUCT_IMAGE_UPLOAD_FOLDER = "hesapisleri/products";

export function validateClientImageFile(file: File, maxImageBytes: number) {
  validateImageFileWithLimits(file, maxImageBytes);
}

export async function uploadImageToCdn(
  file: File,
  folder: string,
  maxImageBytes: number
) {
  validateClientImageFile(file, maxImageBytes);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "Görsel CDN'e yüklenemedi");
  }

  return data.data.url as string;
}

export { formatMaxBytesMessage, formatMaxBytesMbLabel } from "@/lib/storage/upload-limit-utils";
