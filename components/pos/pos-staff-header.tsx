"use client";

import { LogOut } from "lucide-react";

type PosStaffHeaderProps = {
  companyName: string;
  userName: string;
  employeeName?: string | null;
  isPosStaff?: boolean;
};

export function PosStaffHeader({
  companyName,
  userName,
  employeeName,
  isPosStaff = false,
}: PosStaffHeaderProps) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200/70 bg-white px-4 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.035)] sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src="/logo.svg"
          alt="Hesapişleri"
          className="h-9 w-auto shrink-0 object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[#0f1f4d]">
            {companyName}
          </p>
          <p className="truncate text-xs text-slate-500">
            {employeeName ? `${employeeName} · ` : ""}
            {userName}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 text-xs font-black text-[#0f1f4d] transition hover:bg-slate-50"
      >
        <LogOut size={15} />
        Çıkış
      </button>
    </header>
  );
}
