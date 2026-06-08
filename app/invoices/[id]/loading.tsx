import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

export default function InvoiceDetailLoading() {
  return (
    <AppLoadingScreen
      preset="invoices"
      title="Fatura detayı yükleniyor"
      subtitle="Fatura bilgileri getiriliyor..."
    />
  );
}
