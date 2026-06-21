"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Filter, Search, X } from "lucide-react";
import {
  appInputClass,
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
} from "@/lib/admin-ui";
import type { CouponListFilters } from "@/lib/admin/promotions/promotion-types";
import {
  BOOL_FILTER_OPTIONS,
  COUPON_STATUS_OPTIONS,
  COUPON_USAGE_STATUS_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  INTERVAL_FILTER_OPTIONS,
} from "@/lib/admin/promotions/promotion-filter-utils";

type Plan = { id: string; name: string };

function buildParams(filters: CouponListFilters, q: string) {
  const params = new URLSearchParams();
  const merged = { ...filters, q: q || undefined, page: 1 };
  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export function AdminCouponFilters({
  filters,
  plans,
  activeFilterCount,
}: {
  filters: CouponListFilters;
  plans: Plan[];
  activeFilterCount: number;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [q, setQ] = useState(filters.q ?? "");
  const [draft, setDraft] = useState(filters);

  function apply(next: CouponListFilters) {
    router.push(`/admin/membership-coupons?${buildParams(next, q)}`);
  }

  function applyDraft() {
    apply({ ...draft, q: q || undefined });
    setSheetOpen(false);
  }

  function clearAll() {
    setQ("");
    setDraft({});
    router.push("/admin/membership-coupons");
  }

  const advancedFields = (
    <>
      <select
        value={draft.status ?? ""}
        onChange={(e) =>
          setDraft({ ...draft, status: e.target.value as CouponListFilters["status"] || undefined })
        }
        className={appSelectClass}
      >
        {COUPON_STATUS_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={draft.discountType ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            discountType: e.target.value as CouponListFilters["discountType"] || undefined,
          })
        }
        className={appSelectClass}
      >
        {DISCOUNT_TYPE_OPTIONS.map((o) => (
          <option key={o.value || "all-discount"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={draft.planId ?? ""}
        onChange={(e) => setDraft({ ...draft, planId: e.target.value || undefined })}
        className={appSelectClass}
      >
        <option value="">Tüm planlar</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>
      <select
        value={draft.interval ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            interval: e.target.value as CouponListFilters["interval"] || undefined,
          })
        }
        className={appSelectClass}
      >
        {INTERVAL_FILTER_OPTIONS.map((o) => (
          <option key={o.value || "all-interval"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={draft.firstPaymentOnly ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            firstPaymentOnly: e.target.value as CouponListFilters["firstPaymentOnly"] || undefined,
          })
        }
        className={appSelectClass}
      >
        <option value="">İlk ödeme (tümü)</option>
        {BOOL_FILTER_OPTIONS.filter((o) => o.value).map((o) => (
          <option key={`first-${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={draft.renewalAllowed ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            renewalAllowed: e.target.value as CouponListFilters["renewalAllowed"] || undefined,
          })
        }
        className={appSelectClass}
      >
        <option value="">Yenileme (tümü)</option>
        {BOOL_FILTER_OPTIONS.filter((o) => o.value).map((o) => (
          <option key={`renew-${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={draft.usageStatus ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            usageStatus: e.target.value as CouponListFilters["usageStatus"] || undefined,
          })
        }
        className={appSelectClass}
      >
        {COUPON_USAGE_STATUS_OPTIONS.map((o) => (
          <option key={o.value || "all-usage"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={draft.expiresFrom?.slice(0, 10) ?? ""}
        onChange={(e) => setDraft({ ...draft, expiresFrom: e.target.value || undefined })}
        className={appInputClass}
        aria-label="Bitiş tarihi (en erken)"
      />
      <input
        type="date"
        value={draft.expiresTo?.slice(0, 10) ?? ""}
        onChange={(e) => setDraft({ ...draft, expiresTo: e.target.value || undefined })}
        className={appInputClass}
        aria-label="Bitiş tarihi (en geç)"
      />
      <input
        type="date"
        value={draft.createdFrom?.slice(0, 10) ?? ""}
        onChange={(e) => setDraft({ ...draft, createdFrom: e.target.value || undefined })}
        className={appInputClass}
        aria-label="Oluşturulma (en erken)"
      />
      <input
        type="date"
        value={draft.createdTo?.slice(0, 10) ?? ""}
        onChange={(e) => setDraft({ ...draft, createdTo: e.target.value || undefined })}
        className={appInputClass}
        aria-label="Oluşturulma (en geç)"
      />
      <select
        value={draft.sort ?? "code"}
        onChange={(e) => setDraft({ ...draft, sort: e.target.value as CouponListFilters["sort"] })}
        className={appSelectClass}
      >
        <option value="code">Sırala: Kod</option>
        <option value="startsAt">Sırala: Başlangıç</option>
        <option value="expiresAt">Sırala: Bitiş</option>
        <option value="created">Sırala: Oluşturulma</option>
      </select>
      <select
        value={draft.order ?? "asc"}
        onChange={(e) => setDraft({ ...draft, order: e.target.value as CouponListFilters["order"] })}
        className={appSelectClass}
      >
        <option value="asc">Artan</option>
        <option value="desc">Azalan</option>
      </select>
    </>
  );

  return (
    <div className={`${appPanelClass} p-4`}>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply({ ...filters, q: q || undefined });
              }}
              placeholder="Kupon kodu, isim veya açıklama ara..."
              className={`${appInputClass} pl-10`}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              className={`${appOutlineButtonClass} relative md:hidden`}
            >
              <Filter size={16} />
              Filtreler
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => apply({ ...filters, q: q || undefined })}
              className={appPrimaryButtonClass}
            >
              Filtrele
            </button>
            <button type="button" onClick={clearAll} className={appOutlineButtonClass}>
              <X size={16} />
              Temizle
            </button>
          </div>
        </div>

        <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
          {advancedFields}
          <div className="flex items-end gap-2 xl:col-span-2">
            <button type="button" onClick={applyDraft} className={appPrimaryButtonClass}>
              Gelişmiş Filtreleri Uygula
            </button>
          </div>
        </div>

        {sheetOpen ? (
          <div className="grid gap-3 border-t border-slate-100 pt-3 md:hidden">
            {advancedFields}
            <button type="button" onClick={applyDraft} className={appPrimaryButtonClass}>
              Uygula
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
