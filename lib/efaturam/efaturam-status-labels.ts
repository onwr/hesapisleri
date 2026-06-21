import type { InvoiceDocumentSubmissionStatus } from "@prisma/client";

const STATUS_LABELS: Record<InvoiceDocumentSubmissionStatus, string> = {
  DRAFT: "Taslak",
  PENDING: "Beklemede",
  SUBMITTED: "Gönderildi",
  SUCCESS: "Başarılı",
  FAILED: "Hata",
  CANCELLED: "İptal edildi",
};

const PROVIDER_STATUS_LABELS: Record<number, string> = {
  10: "İşlendi",
  20: "Gönderildi",
  30: "Onaylandı",
  40: "Reddedildi",
  50: "İptal edildi",
};

export function getSubmissionStatusLabel(status: InvoiceDocumentSubmissionStatus) {
  return STATUS_LABELS[status] ?? status;
}

export function getProviderStatusLabel(status?: number | null) {
  if (status == null) return "—";
  return PROVIDER_STATUS_LABELS[status] ?? `Durum ${status}`;
}

export function getGibStatusLabel(gibStatus?: string | null) {
  if (!gibStatus) return "—";
  const normalized = gibStatus.toUpperCase();
  if (normalized === "REPORTED") return "Raporlandı";
  if (normalized === "ACCEPTED") return "Kabul edildi";
  if (normalized === "REJECTED") return "Reddedildi";
  if (normalized === "CANCELLED") return "İptal edildi";
  return gibStatus;
}
