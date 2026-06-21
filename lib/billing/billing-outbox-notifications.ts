import type { BillingOutboxEventType } from "@prisma/client";

export function buildBillingNotification(
  type: BillingOutboxEventType,
  aggregateId: string
) {
  switch (type) {
    case "PAYMENT_SUCCEEDED":
      return {
        type: "SUCCESS" as const,
        title: "Ödeme başarılı",
        message: "Üyelik ödemeniz doğrulandı ve aboneliğiniz güncellendi.",
      };
    case "PAYMENT_FAILED":
      return {
        type: "ERROR" as const,
        title: "Ödeme başarısız",
        message: "Üyelik ödemeniz tamamlanamadı. Kartınızı kontrol edebilirsiniz.",
      };
    case "REFUND_SUCCEEDED":
      return {
        type: "INFO" as const,
        title: "İade tamamlandı",
        message: `İade işlemi tamamlandı: ${aggregateId}`,
      };
    case "SUBSCRIPTION_PAST_DUE":
      return {
        type: "WARNING" as const,
        title: "Üyelik ödemesi bekliyor",
        message: "Otomatik yenileme başarısız oldu. Kartınızı güncelleyin.",
      };
    case "SUBSCRIPTION_SUSPENDED":
      return {
        type: "ERROR" as const,
        title: "Üyelik askıya alındı",
        message: "Grace period sona erdi. Billing sayfasından ödeme yapabilirsiniz.",
      };
    case "SUBSCRIPTION_TRIAL_EXTENDED":
      return {
        type: "INFO" as const,
        title: "Deneme süresi uzatıldı",
        message: "Deneme süreniz admin tarafından uzatıldı.",
      };
    case "SUBSCRIPTION_GRACE_EXTENDED":
      return {
        type: "WARNING" as const,
        title: "Ek süre tanımlandı",
        message: "Ödeme için ek süre tanımlandı.",
      };
    case "SUBSCRIPTION_PLAN_CHANGE_SCHEDULED":
      return {
        type: "INFO" as const,
        title: "Plan değişikliği planlandı",
        message: "Plan değişikliği dönem sonunda uygulanacak.",
      };
    case "SUBSCRIPTION_PLAN_CHANGED":
      return {
        type: "INFO" as const,
        title: "Plan değişti",
        message: "Abonelik planınız güncellendi.",
      };
    case "SUBSCRIPTION_INTERVAL_CHANGE_SCHEDULED":
      return {
        type: "INFO" as const,
        title: "Dönem değişikliği planlandı",
        message: "Faturalandırma dönemi dönem sonunda değişecek.",
      };
    case "SUBSCRIPTION_INTERVAL_CHANGED":
      return {
        type: "INFO" as const,
        title: "Dönem değişti",
        message: "Faturalandırma döneminiz güncellendi.",
      };
    case "SUBSCRIPTION_AUTO_RENEW_ENABLED":
      return {
        type: "SUCCESS" as const,
        title: "Otomatik yenileme açıldı",
        message: "Aboneliğiniz dönem sonunda otomatik yenilenecek.",
      };
    case "SUBSCRIPTION_AUTO_RENEW_DISABLED":
      return {
        type: "INFO" as const,
        title: "Otomatik yenileme kapatıldı",
        message: "Aboneliğiniz otomatik yenilenmeyecek.",
      };
    case "SUBSCRIPTION_CANCEL_SCHEDULED":
      return {
        type: "WARNING" as const,
        title: "İptal planlandı",
        message: "Aboneliğiniz dönem sonunda iptal edilecek.",
      };
    case "SUBSCRIPTION_CANCEL_REVOKED":
      return {
        type: "SUCCESS" as const,
        title: "İptal geri alındı",
        message: "Abonelik iptali geri alındı veya planlanan değişiklik iptal edildi.",
      };
    case "SUBSCRIPTION_SPECIAL_PRICE_CREATED":
      return {
        type: "INFO" as const,
        title: "Özel fiyat tanımlandı",
        message: "Aboneliğinize özel fiyat uygulandı.",
      };
    case "SUBSCRIPTION_PRICE_LOCKED":
      return {
        type: "INFO" as const,
        title: "Fiyat kilitlendi",
        message: "Abonelik fiyatınız kilitlendi.",
      };
    case "SUBSCRIPTION_PRICE_UNLOCKED":
      return {
        type: "INFO" as const,
        title: "Fiyat kilidi kaldırıldı",
        message: "Abonelik fiyat kilidi kaldırıldı.",
      };
    case "SUBSCRIPTION_MANUALLY_EXTENDED":
      return {
        type: "SUCCESS" as const,
        title: "Abonelik uzatıldı",
        message: "Abonelik süreniz admin tarafından uzatıldı.",
      };
    case "COUPON_APPLIED":
      return {
        type: "SUCCESS" as const,
        title: "Kupon uygulandı",
        message: "İndirim kodunuz ödemenize uygulandı.",
      };
    case "COUPON_REJECTED":
      return {
        type: "WARNING" as const,
        title: "Kupon reddedildi",
        message: "Girdiğiniz kupon kodu kullanılamadı.",
      };
    default:
      return null;
  }
}
