"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { appOutlineButtonClass } from "@/lib/admin-ui";

type AdminUserMenuProps = {
  userName: string;
  userEmail: string;
  firmPanelHref: string;
};

export function AdminUserMenu({
  userName,
  userEmail,
  firmPanelHref,
}: AdminUserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 shadow-sm shadow-slate-100/70 transition hover:border-blue-100 hover:bg-blue-50/60"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[12px] font-black text-blue-600">
          {userName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-[12px] font-bold text-[#0f1f4d]">
            {userName}
          </span>
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.1)]"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-[13px] font-bold text-[#0f1f4d]">{userName}</p>
            <p className="truncate text-[11px] text-slate-500">{userEmail}</p>
          </div>
          <Link
            href={firmPanelHref}
            role="menuitem"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-[#0f1f4d] hover:bg-blue-50/70 hover:text-blue-600"
            onClick={() => setOpen(false)}
          >
            <ArrowLeft size={14} />
            Firma Paneline Dön
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-bold text-[#0f1f4d] hover:bg-blue-50/70"
          >
            <LogOut size={14} />
            Çıkış Yap
          </button>
        </div>
      ) : null}
    </div>
  );
}
