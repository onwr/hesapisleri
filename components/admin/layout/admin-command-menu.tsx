"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { flattenAdminNavItems } from "./admin-navigation";

type AdminCommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminCommandMenu({ open, onOpenChange }: AdminCommandMenuProps) {
  const [query, setQuery] = useState("");
  const navItems = flattenAdminNavItems().filter((i) => i.enabled !== false);

  const results = navItems.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.href.toLowerCase().includes(q)
    );
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/20 p-4 pt-[12vh] backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Aramayı kapat"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search size={16} className="text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Firma, kullanıcı, ödeme veya işlem ara..."
            className="h-12 flex-1 bg-transparent text-[13px] font-medium text-[#0f1f4d] outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Navigasyon
          </p>
          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-slate-500">
              Sonuç bulunamadı.
            </p>
          ) : (
            results.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[#0f1f4d] transition hover:bg-blue-50/70 hover:text-blue-600"
                >
                  <Icon size={16} className="text-[#1e3a8a]" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminCommandTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full max-w-[420px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-sm shadow-slate-100/70 transition focus-within:border-blue-200 focus-within:shadow-blue-100"
    >
      <Search size={16} className="shrink-0 text-slate-400" />
      <span className="flex-1 truncate text-[13px] font-medium text-slate-400">
        Firma, kullanıcı, ödeme veya işlem ara...
      </span>
      <kbd className="hidden rounded-lg border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
