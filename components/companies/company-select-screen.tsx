"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Check,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CompanyListItem } from "@/lib/create-company-api-utils";
import { filterCompaniesBySearch } from "@/lib/create-company-api-utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function CompanySelectScreen() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/auth/companies");
      const json = await res.json();

      if (!res.ok || !json.success) {
        router.push("/login");
        return;
      }

      setCompanies(json.data ?? []);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const filteredCompanies = useMemo(
    () => filterCompaniesBySearch(companies, search),
    [companies, search]
  );

  async function handleSelect(companyId: string, isCurrent: boolean) {
    if (isCurrent || switchingId) {
      if (isCurrent) {
        router.push("/dashboard");
      }
      return;
    }

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

      router.push(json.data?.redirectTo ?? "/dashboard");
      router.refresh();
    } finally {
      setSwitchingId(null);
    }
  }

  if (loading) {
    return <AppLoadingScreen preset="default" />;
  }

  return (
    <main className="min-h-dvh bg-linear-to-br from-[#f7f8ff] via-white to-[#eef2ff]">
      <img src="/login-bg.png" alt="" className="absolute filter grayscale brightness-150 invert  inset-0 w-full h-full object-cover" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 justify-self-start text-sm font-bold text-slate-500 transition hover:text-[#0f1f4d]"
          >
            <ArrowLeft size={16} />
            Panele dön
          </Link>

          <img
            src="/logo.svg"
            alt="Hesapişleri"
            className="h-10 w-auto justify-self-center"
          />

          <div className="justify-self-end">
            <Button
              asChild
              className="h-11 rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 px-5 text-sm font-black shadow-lg shadow-blue-100"
            >
              <Link href="/companies/new">
                <Plus size={16} />
                Yeni Firma Oluştur
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto container text-center">
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
            Firma seçimi
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-[#0f1f4d] sm:text-4xl">
            Hangi firmayla devam etmek istiyorsunuz?
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
            Çalışmak istediğiniz firmayı seçin veya yeni bir firma oluşturun.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Firma adı veya rol ile ara..."
              className="h-12 rounded-2xl border-slate-200 bg-white pl-11 text-sm font-medium text-[#0f1f4d] shadow-sm"
            />
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-12 text-center">
              <Building2 className="mx-auto size-10 text-slate-300" />
              <p className="mt-4 text-sm font-bold text-slate-600">
                {search.trim()
                  ? "Aramanızla eşleşen firma bulunamadı."
                  : "Henüz bağlı firmanız yok."}
              </p>
              {!search.trim() ? (
                <Button
                  asChild
                  className="mt-5 h-11 rounded-2xl bg-blue-600 px-5 text-sm font-black"
                >
                  <Link href="/companies/new">İlk firmayı oluştur</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            filteredCompanies.map((company) => {
              const isSwitching = switchingId === company.companyId;

              return (
                <button
                  key={company.companyId}
                  type="button"
                  onClick={() =>
                    void handleSelect(company.companyId, company.isCurrent)
                  }
                  className={[
                    "group relative flex w-full flex-col rounded-3xl border bg-white p-5 text-left shadow-sm transition",
                    company.isCurrent
                      ? "border-blue-300 shadow-[0_16px_40px_rgba(37,99,235,0.12)] ring-2 ring-blue-100"
                      : "border-slate-200 hover:border-blue-200 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-black text-slate-500">
                      {company.logoUrl ? (
                        <img
                          src={company.logoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(company.companyName) || (
                          <Building2 size={22} />
                        )
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-black text-[#0f1f4d]">
                          {company.companyName}
                        </p>
                        {company.isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700">
                            <Check size={12} />
                            Aktif
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {company.roleLabel}
                        {company.isOwner ? " · Sahip" : ""}
                      </p>
                      {company.isOwner ? (
                        <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                          Sahip
                        </span>
                      ) : null}
                    </div>

                    {isSwitching ? (
                      <Loader2 className="size-5 shrink-0 animate-spin text-blue-600" />
                    ) : company.isCurrent ? (
                      <Check className="size-5 shrink-0 text-blue-600" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
