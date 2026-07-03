import type { SubscriptionPriceChangePolicy } from "@prisma/client";

export type AdminPricePolicyOption = {
  value: SubscriptionPriceChangePolicy;
  title: string;
  description: string;
  recommended?: boolean;
  risky?: boolean;
};

/** Yönetici arayüzünde gösterilen fiyat politikası seçenekleri. */
export const ADMIN_PRICE_POLICY_OPTIONS: AdminPricePolicyOption[] = [
  {
    value: "NEW_SUBSCRIBERS_ONLY",
    title: "Yalnızca yeni aboneler",
    description:
      "Mevcut aboneler eski fiyatıyla devam eder. Yeni kayıt olan müşteriler yeni fiyattan satın alır.",
    recommended: true,
  },
  {
    value: "NEXT_RENEWAL",
    title: "Mevcut abonelere yenileme tarihinde",
    description: "Mevcut aboneler bir sonraki yenileme döneminde yeni fiyata geçer.",
  },
  {
    value: "AFTER_DATE",
    title: "Tüm abonelere belirlenen tarihte",
    description:
      "Mevcut ve yeni aboneler seçilen tarihten itibaren yeni fiyatı kullanır.",
    risky: true,
  },
];

export function getPricePolicyLabel(policy: string): string {
  return ADMIN_PRICE_POLICY_OPTIONS.find((o) => o.value === policy)?.title ?? policy;
}

export function getPriceStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "SCHEDULED":
      return "Planlandı";
    case "EXPIRED":
      return "Geçmiş";
    case "ARCHIVED":
      return "İptal Edildi";
    case "DRAFT":
      return "Taslak";
    default:
      return status;
  }
}
