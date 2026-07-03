"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import { Building2, Check, ChevronDown, Loader2, LogOut, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CompanyOption = {
  companyId: string;
  companyName: string;
  role: string;
  roleLabel: string;
  isOwner: boolean;
  isActive: boolean;
  isCurrent: boolean;
};

type AppUserMenuProps = {
  userName: string;
  companyName: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppUserMenu({ userName, companyName }: AppUserMenuProps) {
  const router = useRouter();
  const initials = getInitials(userName) || "U";
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/auth/companies");
      const json = await res.json();

      if (res.ok && json.success) {
        setCompanies(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies, companyName]);

  async function handleSwitch(companyId: string) {
    if (switchingId) return;

    setSwitchingId(companyId);

    try {
      const res = await fetch("/api/auth/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        return;
      }

      notifyTenantCacheSync();
      const redirectTo = json.data?.redirectTo ?? "/dashboard";
      window.location.assign(redirectTo);
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const currentCompany =
    companies.find((company) => company.isCurrent) ??
    companies.find((company) => company.companyName === companyName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-[52px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm shadow-slate-100/70 transition hover:border-blue-100 hover:bg-blue-50/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-violet-600 text-[14px] font-black text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)]">
            {initials}
          </div>

          <div className="hidden min-w-[110px] text-left sm:block">
            <p className="max-w-[130px] truncate text-[14px] font-bold leading-5 text-[#0f1f4d]">
              {userName}
            </p>
            <p className="max-w-[130px] truncate text-[12px] font-medium text-slate-500">
              {companyName}
            </p>
          </div>

          <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72 rounded-2xl border border-slate-200/80 p-2 shadow-[0_18px_44px_rgba(15,23,42,0.12)]"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <p className="text-sm font-black text-[#0f1f4d]">{userName}</p>
          <p className="mt-0.5 text-[13px] font-medium text-slate-500">
            {currentCompany?.roleLabel ?? "Kullanıcı"} · {companyName}
          </p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="px-2 text-[12px] font-black uppercase tracking-wide text-slate-400">
          Firmalarım
        </DropdownMenuLabel>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-blue-600" />
          </div>
        ) : companies.length === 0 ? (
          <div className="px-2 py-3 text-[13px] font-medium text-slate-500">
            Bağlı firma bulunamadı.
          </div>
        ) : (
          companies.map((company) => (
            <DropdownMenuItem
              key={company.companyId}
              className="cursor-pointer rounded-xl px-2 py-2.5"
              onClick={() => {
                if (!company.isCurrent) {
                  void handleSwitch(company.companyId);
                }
              }}
            >
              <div className="flex w-full items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Building2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#0f1f4d]">
                    {company.companyName}
                  </p>
                  <p className="text-[12px] font-medium text-slate-500">
                    {company.roleLabel}
                    {company.isOwner ? " · Sahip" : ""}
                  </p>
                </div>
                {company.isCurrent ? (
                  <Check size={16} className="mt-1 shrink-0 text-blue-600" />
                ) : switchingId === company.companyId ? (
                  <Loader2
                    size={16}
                    className="mt-1 shrink-0 animate-spin text-blue-600"
                  />
                ) : null}
              </div>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2 py-2.5">
          <Link
            href="/companies/new"
            className="flex items-center gap-2 text-sm font-bold text-blue-600 focus:text-blue-700"
          >
            <Plus size={16} />
            Yeni Firma Ekle
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2 py-2.5">
          <Link
            href="/companies/select"
            className="text-sm font-semibold text-slate-600"
          >
            Tüm firmaları gör
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="rounded-xl">
          <Link
            href="/settings"
            className="cursor-pointer text-sm font-semibold text-slate-600"
          >
            Ayarlar
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="cursor-pointer rounded-xl text-sm font-semibold text-rose-600 focus:text-rose-700"
          onClick={() => void handleLogout()}
        >
          <LogOut size={16} />
          Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
