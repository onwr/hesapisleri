import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";

export function TeamSettingsBanner() {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[1.25rem] border border-blue-100 bg-linear-to-r from-blue-50 to-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
          <UsersRound size={20} />
        </div>
        <div>
          <p className="font-black text-[#0f1f4d]">
            Çalışan yönetimi artık ayrı bir sayfada
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Ekip üyelerini, davetleri ve rolleri premium arayüzden yönetin.
          </p>
        </div>
      </div>
      <Link
        href="/team"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-4 text-sm font-black text-white"
      >
        Çalışanlar Sayfasına Git
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
