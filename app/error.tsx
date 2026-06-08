"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCcw } from "lucide-react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8ff] px-5">
      <div className="max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-red-100/40">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-600">
          <AlertTriangle size={34} />
        </div>

        <h1 className="mt-6 text-3xl font-black text-slate-950">
          Bir şeyler ters gitti
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          Sayfa yüklenirken beklenmeyen bir hata oluştu. Tekrar deneyebilir
          veya panele dönebilirsiniz.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-100"
          >
            <RefreshCcw size={18} />
            Tekrar Dene
          </button>

          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-sm font-black text-slate-700"
          >
            Panele Dön
          </Link>
        </div>
      </div>
    </main>
  );
}
