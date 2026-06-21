"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import {
  appInputClass,
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
} from "@/lib/admin-ui";
import type { AdminSubscriptionListFilters } from "@/lib/admin-subscription-utils";
import {
  ADMIN_PARTNER_SCOPE_OPTIONS,
  ADMIN_PRICE_SOURCE_FILTER_OPTIONS,
  countActiveSubscriptionFilters,
} from "@/lib/admin-subscription-utils";

type Plan = { id: string; name: string };
type Partner = { id: string; fullName: string; referralCode: string };

const STATUS_OPTIONS = [
  { value: "", label: "Tüm durumlar" },
  { value: "TRIAL", label: "Deneme" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAST_DUE", label: "Ödeme Gecikti" },
  { value: "GRACE_PERIOD", label: "Ek Süre" },
  { value: "CANCEL_AT_PERIOD_END", label: "Dönem Sonunda İptal" },
  { value: "CANCELLED", label: "İptal" },
  { value: "EXPIRED", label: "Süresi Doldu" },
  { value: "SUSPENDED", label: "Askıda" },
];

const INTERVAL_OPTIONS = [
  { value: "", label: "Tüm dönemler" },
  { value: "MONTHLY", label: "Aylık" },
  { value: "QUARTERLY", label: "3 Aylık" },
  { value: "SEMI_ANNUAL", label: "6 Aylık" },
  { value: "YEARLY", label: "Yıllık" },
];

export function AdminSubscriptionFilters({
  filters,
  plans,
  partners = [],
}: {
  filters: AdminSubscriptionListFilters;
  plans: Plan[];
  partners?: Partner[];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveSubscriptionFilters(filters);

  const advancedFields = (
  <>
      <select name="planId" defaultValue={filters.planId ?? ""} className={appSelectClass}>
        <option value="">Tüm planlar</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>
      <select
        name="interval"
        defaultValue={filters.interval ?? ""}
        className={appSelectClass}
      >
        {INTERVAL_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={filters.status ?? ""} className={appSelectClass}>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        name="autoRenew"
        defaultValue={filters.autoRenew ?? ""}
        className={appSelectClass}
      >
        <option value="">Auto-renew (tümü)</option>
        <option value="true">Açık</option>
        <option value="false">Kapalı</option>
      </select>
      <select name="trial" defaultValue={filters.trial ?? ""} className={appSelectClass}>
        <option value="">Trial (tümü)</option>
        <option value="true">Yalnız trial</option>
      </select>
      <select name="grace" defaultValue={filters.grace ?? ""} className={appSelectClass}>
        <option value="">Grace (tümü)</option>
        <option value="true">Grace aktif</option>
      </select>
      <select
        name="hasPaymentMethod"
        defaultValue={filters.hasPaymentMethod ?? ""}
        className={appSelectClass}
      >
        <option value="">Ödeme yöntemi (tümü)</option>
        <option value="true">Var</option>
        <option value="false">Yok</option>
      </select>
      <select
        name="priceSource"
        defaultValue={filters.priceSource ?? ""}
        className={appSelectClass}
      >
        {ADMIN_PRICE_SOURCE_FILTER_OPTIONS.map((o) => (
          <option key={o.value || "all-price"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        name="partnerScope"
        defaultValue={filters.partnerScope ?? ""}
        className={appSelectClass}
      >
        {ADMIN_PARTNER_SCOPE_OPTIONS.map((o) => (
          <option key={o.value || "all-partner"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        name="partnerId"
        list="admin-subscription-partners"
        defaultValue={filters.partnerId ?? ""}
        placeholder="Belirli partner ID veya seçin"
        className={appInputClass}
      />
      <datalist id="admin-subscription-partners">
        {partners.map((partner) => (
          <option
            key={partner.id}
            value={partner.id}
            label={`${partner.fullName} (${partner.referralCode})`}
          />
        ))}
      </datalist>
      <select name="sort" defaultValue={filters.sort ?? "nextBilling"} className={appSelectClass}>
        <option value="nextBilling">Sırala: Sonraki ödeme</option>
        <option value="periodEnd">Sırala: Bitiş</option>
        <option value="created">Sırala: Oluşturulma</option>
        <option value="company">Sırala: Firma</option>
      </select>
      <select name="order" defaultValue={filters.order ?? "asc"} className={appSelectClass}>
        <option value="asc">Artan</option>
        <option value="desc">Azalan</option>
      </select>
    </>
  );

  return (
    <div className={`${appPanelClass} p-4`}>
      <form action="/admin/subscriptions" method="get" className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Firma, e-posta, plan veya abonelik ID ara..."
            className={`${appInputClass} flex-1`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              className={`${appOutlineButtonClass} relative`}
            >
              <Filter size={16} />
              Gelişmiş Filtreler
              {activeCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>
            <button type="submit" className={appPrimaryButtonClass}>
              Filtrele
            </button>
            <a href="/admin/subscriptions" className={appOutlineButtonClass}>
              <X size={16} />
              Temizle
            </a>
          </div>
        </div>

        <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-4">
          {advancedFields}
        </div>

        {sheetOpen ? (
          <div className="grid gap-3 border-t border-slate-100 pt-3 md:hidden">
            {advancedFields}
          </div>
        ) : null}
      </form>
    </div>
  );
}
