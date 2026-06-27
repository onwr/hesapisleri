import Link from "next/link";
import { getPlatformSettings } from "@/lib/admin/platform-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bakım | Hesap İşleri",
  description: "Platform geçici olarak bakım modundadır.",
};

export default async function MaintenancePage() {
  const settings = await getPlatformSettings();
  const message =
    settings.maintenanceMessage?.trim() ||
    "Platform şu anda bakım modundadır. Lütfen daha sonra tekrar deneyin.";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          Bakım modu
        </p>
        <h1 className="mt-3 text-2xl font-black text-[#0f1f4d]">{settings.brandName}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Giriş yap
          </Link>
          <a
            href={`mailto:${settings.supportEmail}`}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Destek ile iletişim
          </a>
        </div>
      </div>
    </div>
  );
}
