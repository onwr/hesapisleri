import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

export default function CashBankAccountDetailLoading() {
  return (
    <AppLoadingScreen
      preset="default"
      title="Hesap detayı yükleniyor"
      subtitle="Hareket geçmişi hazırlanıyor..."
    />
  );
}
