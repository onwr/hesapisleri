type InvoiceType = "NORMAL" | "E_INVOICE" | "E_ARCHIVE";
type InvoiceStatus = "DRAFT" | "SENT" | "APPROVED" | "CANCELLED" | "ERROR";

export function generateInvoiceNo(type: InvoiceType) {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);

  if (type === "E_INVOICE") return `EFT-${year}-${random}`;
  if (type === "E_ARCHIVE") return `EAR-${year}-${random}`;
  return `FTR-${year}-${random}`;
}

export function getMockGibMeta(
  type: InvoiceType,
  status: InvoiceStatus
): { gibStatus: string; gibMessage: string } {
  if (status === "DRAFT") {
    return {
      gibStatus: "TASLAK",
      gibMessage: "Taslak olarak kaydedildi.",
    };
  }

  if (status === "ERROR") {
    return {
      gibStatus: "HATA",
      gibMessage:
        "GİB bağlantısı simüle edildi. Gerçek entegrasyon sonraki aşamada eklenecek.",
    };
  }

  if (status === "APPROVED") {
    return {
      gibStatus: "ONAY_BEKLIYOR",
      gibMessage: "Fatura onay bekliyor.",
    };
  }

  if (status === "SENT") {
    if (type === "E_ARCHIVE") {
      return {
        gibStatus: "GONDERILDI",
        gibMessage: "e-Arşiv faturası gönderildi (simülasyon).",
      };
    }

    return {
      gibStatus: "GONDERILDI",
      gibMessage: "Fatura başarıyla gönderildi (simülasyon).",
    };
  }

  return {
    gibStatus: "HAZIR",
    gibMessage: "Fatura kaydı oluşturuldu.",
  };
}

export function resolveInvoiceStatusForType(
  type: InvoiceType,
  requested?: InvoiceStatus
): InvoiceStatus {
  if (requested) return requested;
  if (type === "NORMAL") return "DRAFT";
  return "SENT";
}
