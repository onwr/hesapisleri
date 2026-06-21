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
import type { CampaignListFilters } from "@/lib/admin/promotions/promotion-types";
import {
  BOOL_FILTER_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  INTERVAL_FILTER_OPTIONS,
} from "@/lib/admin/promotions/promotion-filter-utils";

type Plan = { id: string; name: string };

function buildParams(filters: CampaignListFilters, q: string) {
  const params = new URLSearchParams();
  const merged = { ...filters, q: q || undefined, page: 1 };
  Object.entries(merged).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export function AdminCampaignFilters({
  filters,
  plans,
  activeFilterCount,
}: {
  filters: CampaignListFilters;
  plans: Plan[];
  activeFilterCount: number;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [q, setQ] = useState(filters.q ?? "");
  const [draft, setDraft] = useState(filters);

  function apply(next: CampaignListFilters) {
    router.push(`/admin/membership-campaigns?${buildParams(next, q)}`);
  }

  function applyDraft() {
    apply({ ...draft, q: q || undefined });
    setSheetOpen(false);
  }

  function clearAll() {
    setQ("");
    setDraft({});
    router.push("/admin/membership-campaigns");
  }

  const advancedFields = (
    <>
      <select
        value={draft.status ?? ""}
        onChange={(e) => setDraft({ ...draft, status: e.target.value as CampaignListFilters["status"] || undefined })}
        className={appSelectClass}
      >
        {CAMPAIGN_STATUS_OPTIONS.map((o) => (
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
            discountType: e.target.value as CampaignListFilters["discountType"] || undefined,
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
            interval: e.target.value as CampaignListFilters["interval"] || undefined,
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
        value={draft.autoApply ?? ""}
        onChange={(e) =>
          setDraft({ ...draft, autoApply: e.target.value as CampaignListFilters["autoApply"] || undefined })
        }
        className={appSelectClass}
      >
        <option value="">Otomatik uygulama (tümü)</option>
        {BOOL_FILTER_OPTIONS.filter((o) => o.value).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={draft.stackable ?? ""}
        onChange={(e) =>
          setDraft({ ...draft, stackable: e.target.value as CampaignListFilters["stackable"] || undefined })
        }
        className={appSelectClass}
      >
        <option value="">Stackable (tümü)</option>
        {BOOL_FILTER_OPTIONS.filter((o) => o.value).map((o) => (
          <option key={`stack-${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={draft.renewalAllowed ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            renewalAllowed: e.target.value as CampaignListFilters["renewalAllowed"] || undefined,
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
        value={draft.firstPaymentOnly ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            firstPaymentOnly: e.target.value as CampaignListFilters["firstPaymentOnly"] || undefined,
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
        value={draft.companyScoped ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            companyScoped: e.target.value as CampaignListFilters["companyScoped"] || undefined,
          })
        }
        className={appSelectClass}
      >
        <option value="">Firma kapsamı (tümü)</option>
        <option value="true">Firma kapsamlı</option>
      </select>
      <select
        value={draft.partnerScoped ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            partnerScoped: e.target.value as CampaignListFilters["partnerScoped"] || undefined,
          })
        }
        className={appSelectClass}
      >
        <option value="">Partner kapsamı (tümü)</option>
        <option value="true">Partner kapsamlı</option>
      </select>
      <input
        type="date"
        value={draft.startsFrom?.slice(0, 10) ?? ""}
        onChange={(e) => setDraft({ ...draft, startsFrom: e.target.value || undefined })}
        className={appInputClass}
        aria-label="Başlangıç tarihi (en erken)"
      />
      <input
        type="date"
        value={draft.startsTo?.slice(0, 10) ?? ""}
        onChange={(e) => setDraft({ ...draft, startsTo: e.target.value || undefined })}
        className={appInputClass}
        aria-label="Başlangıç tarihi (en geç)"
      />
      <select
        value={draft.sort ?? "startsAt"}
        onChange={(e) =>
          setDraft({ ...draft, sort: e.target.value as CampaignListFilters["sort"] })
        }
        className={appSelectClass}
      >
        <option value="startsAt">Sırala: Başlangıç</option>
        <option value="name">Sırala: Ad</option>
        <option value="priority">Sırala: Öncelik</option>
        <option value="created">Sırala: Oluşturulma</option>
      </select>
      <select
        value={draft.order ?? "desc"}
        onChange={(e) =>
          setDraft({ ...draft, order: e.target.value as CampaignListFilters["order"] })
        }
        className={appSelectClass}
      >
        <option value="desc">Azalan</option>
        <option value="asc">Artan</option>
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
              placeholder="Kampanya adı, kod veya açıklama ara..."
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
