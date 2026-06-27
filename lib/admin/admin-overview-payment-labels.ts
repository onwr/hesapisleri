import type { MembershipPaymentStatus } from "@prisma/client";
import { getMembershipPaymentStatusLabel } from "@/lib/membership-utils";

export function summarizeMembershipPaymentError(input: {
  status: MembershipPaymentStatus | string;
  failedReasonCode?: string | null;
  failedReasonMessage?: string | null;
  providerStatus?: string | null;
}) {
  if (input.status === "WAIT_CALLBACK" || input.status === "UNKNOWN") {
    return "Ödeme doğrulama veya PayTR bildirimi bekleniyor";
  }

  if (input.status === "PENDING" || input.status === "FORM_READY") {
    return "Ödeme henüz tamamlanmadı";
  }

  const code = input.failedReasonCode?.toLowerCase() ?? "";
  const message = input.failedReasonMessage?.toLowerCase() ?? "";

  if (code.includes("insufficient") || message.includes("yetersiz")) {
    return "Yetersiz bakiye veya kart limiti";
  }

  if (code.includes("3d") || message.includes("3d")) {
    return "3D Secure doğrulaması başarısız";
  }

  if (code.includes("timeout") || message.includes("zaman")) {
    return "Ödeme zaman aşımına uğradı";
  }

  if (input.providerStatus?.toLowerCase().includes("failed")) {
    return "Ödeme sağlayıcısı işlemi reddetti";
  }

  if (input.status === "FAILED") {
    return "Ödeme tamamlanamadı";
  }

  return getMembershipPaymentStatusLabel(
    input.status as MembershipPaymentStatus
  );
}
