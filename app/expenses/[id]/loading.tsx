import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

export default function ExpenseDetailLoading() {
  return (
    <AppLoadingScreen
      preset="expenses"
      title="Gider detayı yükleniyor"
      subtitle="Gider bilgileri hazırlanıyor..."
    />
  );
}
