import Link from "next/link";
import { KvkkAydinlatmaContent } from "@/components/legal/kvkk-aydinlatma-content";

export const metadata = {
  title: "KVKK Aydınlatma Metni | Hesapisleri",
  description:
    "Hesap İşleri kayıt aydınlatma metni — kişisel verilerin işlenmesine ilişkin bilgilendirme",
};

export default function KvkkAydinlatmaMetniPage() {
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/register"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          ← Kayıt sayfasına dön
        </Link>

        <div className="mt-6">
          <KvkkAydinlatmaContent />
        </div>
      </div>
    </div>
  );
}
