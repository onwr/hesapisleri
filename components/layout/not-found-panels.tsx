"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, LayoutDashboard, SearchX } from "lucide-react";

export function AuthenticatedNotFoundPanel() {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-2 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
        <SearchX size={34} />
      </div>

      <h1 className="mt-6 text-3xl font-black text-[#0f1f4d]">Sayfa bulunamadı</h1>

      <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir. Menüden devam
        edebilir veya önceki sayfaya dönebilirsiniz.
      </p>

      <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-100"
        >
          <LayoutDashboard size={18} />
          Panele Dön
        </Link>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#0f1f4d] transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
          Önceki Sayfaya Dön
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#0f1f4d] transition hover:bg-slate-50"
        >
          <Home size={18} />
          Ana Sayfa
        </Link>
      </div>
    </div>
  );
}

export function PublicNotFoundPanel() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#f7f8ff] px-5"
      id="main-content"
      tabIndex={-1}
    >
      <div className="max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-blue-100/40">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
          <SearchX size={34} />
        </div>

        <h1 className="mt-6 text-3xl font-black text-slate-950">Sayfa bulunamadı</h1>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir. Adresi kontrol
          edin veya ana sayfaya dönün.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-100"
          >
            <Home size={18} />
            Ana Sayfa
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-[#0f1f4d] transition hover:bg-slate-50"
          >
            Giriş Yap
          </Link>
        </div>
      </div>
    </main>
  );
}
