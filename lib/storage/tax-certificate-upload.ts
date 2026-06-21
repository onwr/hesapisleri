import { validateTaxCertificateFile } from "@/lib/storage/upload-validation";

export const CUSTOMER_TAX_CERTIFICATE_UPLOAD_FOLDER =
  "hesapisleri/customers/tax-certificates";

export async function uploadTaxCertificateToCdn(file: File) {
  validateTaxCertificateFile(file);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", CUSTOMER_TAX_CERTIFICATE_UPLOAD_FOLDER);
  formData.append("purpose", "tax-certificate");

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "Vergi levhası yüklenemedi.");
  }

  return data.data.url as string;
}
