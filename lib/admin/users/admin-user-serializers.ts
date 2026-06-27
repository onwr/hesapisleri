import type { EmailVerificationStatus, LoginTrackingStatus, Status } from "@prisma/client";

// IP adresini maskele: "192.168.1.100" → "192.168.x.x"
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  // IPv6: ilk 2 grup göster
  const v6parts = ip.split(":");
  if (v6parts.length > 2) {
    return `${v6parts[0]}:${v6parts[1]}:…`;
  }
  return "—";
}

export function getUserStatusLabel(status: Status): string {
  if (status === "ACTIVE") return "Aktif";
  if (status === "PASSIVE") return "Pasif";
  if (status === "SUSPENDED") return "Askıda";
  return "Bilinmiyor";
}

export function getUserStatusClass(status: Status): string {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "PASSIVE") return "bg-slate-100 text-slate-600";
  if (status === "SUSPENDED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export function getEmailVerificationLabel(
  status: EmailVerificationStatus
): string {
  if (status === "VERIFIED") return "Doğrulandı";
  if (status === "PENDING") return "Doğrulama Bekliyor";
  return "İzlenmiyor";
}

export function getLoginTrackingLabel(status: LoginTrackingStatus): string {
  if (status === "LOGGED_IN") return "Giriş Yapıldı";
  if (status === "NEVER_LOGGED_IN") return "Hiç Giriş Yapılmadı";
  return "Giriş Geçmişi İzlenmiyor";
}
