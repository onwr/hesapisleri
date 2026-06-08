export const PRODUCT_IMAGE_UPLOAD_FOLDER = "hesapisleri/products";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateClientImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Sadece JPEG, PNG veya WebP yükleyebilirsiniz");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Dosya boyutu 5MB'dan küçük olmalıdır");
  }
}

export async function uploadImageToCdn(file: File, folder: string) {
  validateClientImageFile(file);

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
