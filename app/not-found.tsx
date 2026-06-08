import Link from "next/link";
import { Home, SearchX } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8ff] px-5">
      <div className="max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-blue-100/40">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
          <SearchX size={34} />
        </div>

        <h1 className="mt-6 text-3xl font-black text-slate-950">
          Sayfa bulunamadı
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          Açmaya çalıştığınız sayfa silinmiş, taşınmış veya bu sayfaya erişim
          yetkiniz olmayabilir.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-100"
        >
          <Home size={18} />
          Panele Dön
        </Link>
      </div>
    </main>
  );
}
