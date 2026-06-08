import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export default function UnauthorizedPage() {
  return (
    <AppShell>
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-600">
          <ShieldAlert size={30} />
        </div>

        <h1 className="mt-6 text-3xl font-black text-slate-950">
          Erişim yetkiniz yok
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          Bu sayfaya veya modüle erişim için rolünüzde yeterli yetki bulunmuyor.
          Sorun olduğunu düşünüyorsanız firma yöneticinizle iletişime geçin.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 text-sm font-black text-white"
        >
          Dashboard&apos;a Dön
        </Link>
      </div>
    </AppShell>
  );
}
