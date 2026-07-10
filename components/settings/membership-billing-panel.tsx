"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantCacheSync } from "@/hooks/use-tenant-cache-sync";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CreditCard,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { formatMoney, formatNumber, formatShortDisplayDate } from "@/lib/format-utils";
import { MEMBERSHIP_PERIOD_OPTIONS } from "@/lib/membership-utils";
import type { MembershipPeriod } from "@prisma/client";
import { SipayCheckoutButton } from "@/components/billing/sipay-checkout-button";

import type { BillingCheckoutProviderInfo } from "@/lib/payments/billing-provider-resolver";

type PaytrFormPayload = {
  paymentId: string;
  merchantOid: string;
  mode?: "iframe" | "direct";
  actionUrl?: string;
  fields?: Record<string, string>;
  iframeToken?: string;
  iframeUrl?: string;
  resumed?: boolean;
};

type BillingData = {
  subscription: {
    status: string;
    statusLabel: string;
    plan: { id: string; name: string };
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt?: string | null;
    nextBillingDate?: string | null;
    primaryDateLabel?: string | null;
    primaryDateDisplay?: string | null;
    periodEndDisplay?: string | null;
    remainingDays: number;
    isExpired: boolean;
  };
  lastPayment: {
    amount: number;
    paidAt: string | null;
    periodLabel: string;
  } | null;
  pendingPayment: {
    id: string;
    period: MembershipPeriod | null;
    periodLabel: string;
    amount: number;
    currency: string;
    status: string;
    statusLabel: string;
    createdAt: string;
  } | null;
  payments: Array<{
    id: string;
    periodLabel: string;
    amount: number;
    currency: string;
    status: string;
    statusLabel: string;
    paymentMethodLabel: string;
    periodStart: string;
    periodEnd: string;
    paidAt: string | null;
    paymentRef: string | null;
    note: string | null;
  }>;
  plan: {
    id: string;
    name: string;
    prices: Record<MembershipPeriod, number>;
    currency: string;
    pricesAreCheckoutTotals?: boolean;
    vatRate?: number;
    vatIncluded?: boolean;
    usesGrandfatheredPrice?: boolean;
    priceLockNotice?: string | null;
  };
  isOnArchivedPlan?: boolean;
  isSharedEntitlement?: boolean;
  canManageBilling?: boolean;
  sharedEntitlementSourceCompanyName?: string | null;
  scheduledPlanChange?: { targetPlanName: string; effectiveAt: string } | null;
  bankTransferInfo: { note: string };
  paytr: {
    capabilities: {
      integrationMode: "iframe" | "direct";
      autoRenewAvailable: boolean;
      manualRenewalOnly: boolean;
      renewalMode: "manual" | "automatic";
      checkoutHint: string;
    };
    subscription: {
      autoRenew: boolean;
      hasSavedCard: boolean;
    };
  };
  checkout: {
    provider: "SIPAY" | "PAYTR";
    sipayEnabled: boolean;
    paytrEnabled: boolean;
  };
};

function getStatusBadgeClass(status: string) {
  if (status === "ACTIVE" || status === "PAID") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (status === "TRIAL") return "bg-violet-50 text-violet-700 border-violet-200";
  if (status === "EXPIRED" || status === "FAILED") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (status === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function MembershipBillingPanel({
  checkoutProvider,
}: {
  checkoutProvider: BillingCheckoutProviderInfo;
}) {
  const isSipayCheckout =
    checkoutProvider.provider === "SIPAY" && checkoutProvider.sipayEnabled;
  const isPaytrCheckout =
    checkoutProvider.provider === "PAYTR" && checkoutProvider.paytrEnabled;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<BillingData | null>(null);
  const [paytrForm, setPaytrForm] = useState<PaytrFormPayload | null>(null);
  const [autoRenew, setAutoRenew] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [selectedBillingInterval, setSelectedBillingInterval] =
    useState<MembershipPeriod>("YEARLY");
  const [couponPreview, setCouponPreview] = useState<{
    valid: boolean;
    message?: string;
    totalFormatted?: string;
    discountMinor?: number;
    interval?: MembershipPeriod;
  } | null>(null);
  const [resuming, setResuming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sipayIdempotencyKey] = useState(() => crypto.randomUUID());

  const validateCoupon = useCallback(
    async (code: string, interval: MembershipPeriod) => {
      if (!data || !code.trim()) {
        setCouponPreview(null);
        return;
      }

      const res = await fetch("/api/billing/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          planId: data.plan.id,
          billingInterval: interval,
        }),
      });
      const json = await res.json();

      if (res.status === 429) {
        setCouponPreview({
          valid: false,
          message: json.message ?? "Çok fazla deneme yapıldı.",
          interval,
        });
        return;
      }

      if (json.data?.valid) {
        setCouponPreview({
          valid: true,
          totalFormatted: json.data.pricePreview.totalFormatted,
          discountMinor: json.data.discountMinor,
          interval,
        });
      } else {
        setCouponPreview({
          valid: false,
          message: json.data?.reason ?? json.message ?? "Kupon geçersiz.",
          interval,
        });
      }
    },
    [data]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/membership/billing");
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Üyelik bilgileri yüklenemedi.");
        return;
      }

      setData(json.data);

      const paytr = json.data.paytr as BillingData["paytr"];
      if (paytr?.capabilities.autoRenewAvailable) {
        setAutoRenew(Boolean(paytr.subscription.autoRenew));
        setSaveCard(Boolean(paytr.subscription.hasSavedCard || paytr.subscription.autoRenew));
      } else {
        setAutoRenew(false);
        setSaveCard(false);
      }

      const pending = json.data.pendingPayment as BillingData["pendingPayment"];
      if (pending?.period) {
        setSelectedBillingInterval(pending.period);
      }
    } catch {
      setError("Üyelik bilgileri yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const available = MEMBERSHIP_PERIOD_OPTIONS.filter(
      (option) => data.plan.prices[option.period] > 0
    );
    if (!available.length) return;
    if (data.plan.prices[selectedBillingInterval] <= 0) {
      setSelectedBillingInterval(available[0]!.period);
    }
  }, [data, selectedBillingInterval]);

  useTenantCacheSync(() => {
    void load();
  }, { refresh: true });

  const resumePendingPayment = useCallback(
    async (paymentId: string) => {
      setResuming(true);
      setError("");
      setSuccess("");

      try {
        const res = await fetch(`/api/billing/payments/${paymentId}/resume`, {
          method: "POST",
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          setError(json.message || "Ödeme devam ettirilemedi.");
          return;
        }

        setPaytrForm(json.data);
        setSuccess("Kaldığınız yerden devam edin — kart bilgilerinizi girin.");
      } catch {
        setError("Ödeme devam ettirilemedi.");
      } finally {
        setResuming(false);
      }
    },
    []
  );

  async function handleSyncPending() {
    if (!data?.pendingPayment) return;

    setSyncing(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `/api/billing/payments/${data.pendingPayment.id}/sync`,
        { method: "POST" }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Ödeme durumu doğrulanamadı.");
        return;
      }

      if (json.data.status === "PAID") {
        setPaytrForm(null);
        setSuccess(json.data.message || "Ödeme onaylandı, üyelik aktif edildi.");
      } else {
        setSuccess(json.data.message || "PayTR henüz kesin sonuç döndürmedi.");
      }

      await load();
    } catch {
      setError("Ödeme durumu doğrulanamadı.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleCancelPending() {
    if (!data?.pendingPayment) return;

    setCancelling(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `/api/billing/payments/${data.pendingPayment.id}/cancel`,
        { method: "POST" }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Ödeme iptal edilemedi.");
        return;
      }

      setPaytrForm(null);
      setSuccess(json.message || "Ödeme iptal edildi.");
      await load();
    } catch {
      setError("Ödeme iptal edilemedi.");
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    if (!couponCode.trim() || !couponPreview?.valid) return;
    if (couponPreview.interval === selectedBillingInterval) return;
    void validateCoupon(couponCode, selectedBillingInterval);
  }, [
    selectedBillingInterval,
    couponCode,
    couponPreview?.valid,
    couponPreview?.interval,
    validateCoupon,
  ]);

  const selectedPeriodOption = useMemo(
    () =>
      MEMBERSHIP_PERIOD_OPTIONS.find(
        (option) => option.period === selectedBillingInterval
      ),
    [selectedBillingInterval]
  );

  const selectedPrice = useMemo(() => {
    if (!data) return 0;
    return data.plan.prices[selectedBillingInterval];
  }, [data, selectedBillingInterval]);

  const checkoutTotalLabel = useMemo(() => {
    if (
      couponPreview?.valid &&
      couponPreview.interval === selectedBillingInterval &&
      couponPreview.totalFormatted
    ) {
      return couponPreview.totalFormatted;
    }

    return formatMoney(selectedPrice);
  }, [couponPreview, selectedBillingInterval, selectedPrice]);

  const iframePaymentLabel = useMemo(() => {
    if (data?.pendingPayment) {
      return `${data.pendingPayment.periodLabel} · ${formatMoney(data.pendingPayment.amount)}`;
    }
    return `${selectedPeriodOption?.label ?? "Paket"} · ${checkoutTotalLabel}`;
  }, [data?.pendingPayment, selectedPeriodOption?.label, checkoutTotalLabel]);

  useEffect(() => {
    const isIframeCheckout =
      paytrForm?.mode === "iframe" && Boolean(paytrForm.iframeUrl);
    if (!isIframeCheckout) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [paytrForm]);

  async function handlePay() {
    if (!data) return;

    setSaving(true);
    setError("");
    setSuccess("");

    if (couponCode.trim()) {
      if (
        !couponPreview?.valid ||
        couponPreview.interval !== selectedBillingInterval
      ) {
        setError("Ödeme öncesi kuponu seçili dönem için doğrulayın.");
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/billing/payments/paytr/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: data.plan.id,
          billingPeriod: selectedBillingInterval,
          autoRenew: data.paytr.capabilities.autoRenewAvailable ? autoRenew : false,
          saveCard: data.paytr.capabilities.autoRenewAvailable ? saveCard : false,
          couponCode:
            couponPreview?.valid &&
            couponPreview.interval === selectedBillingInterval
              ? couponCode.trim()
              : undefined,
          consentVersion:
            data.paytr.capabilities.autoRenewAvailable && saveCard
              ? "paytr-card-storage-v1"
              : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Ödeme talebi oluşturulamadı.");
        return;
      }

      setPaytrForm(json.data);
      setSuccess(
        json.data.resumed
          ? "Kaldığınız yerden devam edin — kart bilgilerinizi girin."
          : "Kart bilgilerinizi girerek ödemeyi tamamlayın."
      );
      await load();
    } catch {
      setError("Ödeme talebi oluşturulurken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6">
        <Loader2 className="animate-spin text-[#0f1f4d]" size={20} />
        <span className="text-[12px] font-semibold text-slate-600">
          Yükleniyor...
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-[12px] font-semibold text-red-700">
        {error || "Üyelik bilgisi bulunamadı."}
      </div>
    );
  }

  if (paytrForm?.mode === "iframe" && paytrForm.iframeUrl) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-white">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-black text-[#0f1f4d]">Güvenli Ödeme</p>
            <p className="truncate text-[11px] font-semibold text-slate-500">
              {iframePaymentLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data.pendingPayment &&
            ["CREATED", "FORM_READY"].includes(data.pendingPayment.status) ? (
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void handleCancelPending()}
                className="h-9 rounded-lg border border-slate-200 px-3 text-[11px] font-black text-slate-700 disabled:opacity-50"
              >
                {cancelling ? "İptal..." : "İptal et"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPaytrForm(null);
                  setSuccess("");
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-black text-slate-700"
              >
                <ArrowLeft size={14} />
                Geri
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPaytrForm(null);
                setSuccess("");
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
              aria-label="Ödeme ekranını kapat"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {error ? (
          <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <iframe
          src={paytrForm.iframeUrl}
          title="PayTR Ödeme"
          className="min-h-0 w-full flex-1 border-0 bg-white"
          allow="payment"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-slate-500 transition hover:text-[#0f1f4d]"
          >
            <ArrowLeft size={14} />
            Ayarlara dön
          </Link>
          <h1 className="mt-1 text-[18px] font-black text-[#0f1f4d]">
            Üyelik ve Ödeme
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "rounded-md border px-2 py-1 text-[10px] font-black",
              getStatusBadgeClass(data.subscription.status),
            ].join(" ")}
          >
            {data.subscription.statusLabel}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
            {formatNumber(data.subscription.remainingDays)} gün kaldı
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            {data.subscription.primaryDateLabel ?? "Paket bitiş tarihi"}:{" "}
            {data.subscription.primaryDateDisplay ??
              formatShortDisplayDate(data.subscription.currentPeriodEnd)}
          </span>
        </div>
      </div>

      {data.subscription.isExpired ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">
          Üyelik süreniz doldu. Devam etmek için paket seçip ödeme yapın.
        </div>
      ) : null}

      {data.isSharedEntitlement ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] font-semibold text-violet-800">
          Bu paket {data.sharedEntitlementSourceCompanyName ?? "başka bir firma"}{" "}
          üzerinden kullanılmaktadır. Paket değişikliği, iptal, yenileme ve ödeme
          yöntemi işlemleri yalnız aboneliğin sahibi firma üzerinden yapılabilir.
        </div>
      ) : null}

      {data.isOnArchivedPlan ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          Bu paket yeni satışlara kapatılmıştır. Mevcut aboneliğiniz etkilenmez.
        </div>
      ) : null}

      {data.scheduledPlanChange ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] font-semibold text-blue-800">
          Paketiniz {formatShortDisplayDate(data.scheduledPlanChange.effectiveAt)}{" "}
          tarihinde {data.scheduledPlanChange.targetPlanName} planına geçecektir.
          Mevcut döneminiz değişmez.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      {data.pendingPayment &&
      ["CREATED", "FORM_READY", "PENDING", "WAIT_CALLBACK", "UNKNOWN"].includes(
        data.pendingPayment.status
      ) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[12px] font-black text-amber-900">
              Devam eden ödeme: {data.pendingPayment.periodLabel} ·{" "}
              {formatMoney(data.pendingPayment.amount)}
            </p>
            <p className="text-[11px] font-semibold text-amber-800">
              {data.pendingPayment.status === "FORM_READY" ||
              data.pendingPayment.status === "CREATED"
                ? "Ödeme tamamlandıysa durumu kontrol edin. Yarım kaldıysa devam edin veya iptal edip yeni paket seçin."
                : "Banka onayı bekleniyor. Durumu kontrol edin veya birkaç dakika bekleyin."}
            </p>
          </div>
          {["CREATED", "FORM_READY", "PENDING", "WAIT_CALLBACK", "UNKNOWN"].includes(
            data.pendingPayment.status
          ) ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={syncing}
                onClick={() => void handleSyncPending()}
                className="h-8 rounded-lg bg-[#0f1f4d] px-3 text-[11px] font-black text-white disabled:opacity-50"
              >
                {syncing ? "Kontrol..." : "Durumu kontrol et"}
              </button>
              {["CREATED", "FORM_READY"].includes(data.pendingPayment.status) &&
              !paytrForm ? (
                <button
                  type="button"
                  disabled={resuming}
                  onClick={() => void resumePendingPayment(data.pendingPayment!.id)}
                  className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-[11px] font-black text-amber-900 disabled:opacity-50"
                >
                  {resuming ? "Yükleniyor..." : "Ödemeye devam et"}
                </button>
              ) : null}
              {["CREATED", "FORM_READY"].includes(data.pendingPayment.status) ? (
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void handleCancelPending()}
                  className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-[11px] font-black text-amber-900 disabled:opacity-50"
                >
                  {cancelling ? "İptal..." : "İptal et"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-[13px] font-black text-[#0f1f4d]">Paket Seçin</p>
          <p className="text-[11px] text-slate-500">
            {data.subscription.plan.name} · ödenecek tutarlar KDV dahil ·{" "}
            {isSipayCheckout
              ? "Sipay 3D Secure"
              : `PayTR ${paytrForm?.mode === "iframe" ? "iFrame" : "3D Secure"}`}
          </p>
        </div>

        {data.plan.priceLockNotice ? (
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-[11px] font-semibold text-amber-900">
            {data.plan.priceLockNotice}
          </div>
        ) : null}

        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {MEMBERSHIP_PERIOD_OPTIONS.filter((option) => {
            const price = data.plan.prices[option.period];
            return price > 0;
          }).map((option) => {
            const price = data.plan.prices[option.period];
            const selected = selectedBillingInterval === option.period;

            return (
              <button
                key={option.period}
                type="button"
                onClick={() => setSelectedBillingInterval(option.period)}
                className={[
                  "relative rounded-xl border p-3 text-left transition",
                  selected
                    ? "border-[#0f1f4d] bg-blue-50/60 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300",
                ].join(" ")}
              >
                {option.badge ? (
                  <span className="absolute right-2 top-2 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-black text-violet-700">
                    {option.badge}
                  </span>
                ) : null}
                <p className="text-[12px] font-black text-[#0f1f4d]">
                  {option.label}
                </p>
                <p className="mt-1 text-[18px] font-extrabold tracking-[-0.03em] text-[#0f1f4d]">
                  {formatMoney(price)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {option.months} ay · KDV dahil
                </p>
              </button>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-slate-500">Ödenecek tutar</p>
              <p className="text-[22px] font-black text-[#0f1f4d]">
                {checkoutTotalLabel}
              </p>
              <p className="text-[11px] text-slate-500">
                {selectedPeriodOption?.label} paket
              </p>
            </div>

            <div className="flex w-full max-w-md flex-1 gap-2 sm:w-auto">
              <input
                value={couponCode}
                onChange={(event) => {
                  setCouponCode(event.target.value.toUpperCase());
                  setCouponPreview(null);
                }}
                placeholder="Kupon kodu"
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold uppercase text-[#0f1f4d] outline-none focus:border-blue-300"
              />
              <button
                type="button"
                disabled={!couponCode.trim() || saving}
                onClick={() =>
                  void validateCoupon(couponCode, selectedBillingInterval)
                }
                className="h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-[#0f1f4d] disabled:opacity-50"
              >
                Uygula
              </button>
            </div>
          </div>

          {couponPreview?.valid &&
          couponPreview.interval === selectedBillingInterval ? (
            <p className="text-[11px] font-semibold text-emerald-700">
              Kupon uygulandı
            </p>
          ) : null}
          {couponPreview && !couponPreview.valid ? (
            <p className="text-[11px] font-semibold text-red-600">
              {couponPreview.message}
            </p>
          ) : null}

          {isPaytrCheckout && data.paytr.capabilities.manualRenewalOnly ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
              {data.paytr.capabilities.checkoutHint}
            </p>
          ) : isPaytrCheckout ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-600">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(event) => {
                    setAutoRenew(event.target.checked);
                    if (event.target.checked) setSaveCard(true);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                Otomatik yenile
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={saveCard}
                  disabled={autoRenew}
                  onChange={(event) => setSaveCard(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                Kartı sakla
              </label>
            </div>
          ) : isSipayCheckout ? (
            <p className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] font-semibold text-slate-600">
              Kart bilgileriniz Sipay&apos;in güvenli ödeme sayfasında girilir. 3D Secure
              doğrulaması uygulanır; kart numarası bu sitede toplanmaz.
            </p>
          ) : null}

          {isSipayCheckout && !paytrForm ? (
            <SipayCheckoutButton
              planId={data.plan.id}
              billingPeriod={selectedBillingInterval}
              idempotencyKey={sipayIdempotencyKey}
              planName={data.plan.name}
              periodLabel={selectedPeriodOption?.label ?? selectedBillingInterval}
              amountLabel={checkoutTotalLabel}
              disabled={
                saving ||
                resuming ||
                Boolean(
                  data.pendingPayment &&
                    ["PENDING", "WAIT_CALLBACK", "UNKNOWN"].includes(
                      data.pendingPayment.status,
                    ),
                )
              }
            />
          ) : null}

          {isPaytrCheckout && !paytrForm ? (
            <button
              type="button"
              disabled={
                saving ||
                resuming ||
                Boolean(
                  data.pendingPayment &&
                    ["PENDING", "WAIT_CALLBACK", "UNKNOWN"].includes(
                      data.pendingPayment.status
                    )
                )
              }
              onClick={() => void handlePay()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] text-[13px] font-black text-white transition hover:bg-[#16285f] disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
            >
              {saving || resuming ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <CreditCard size={16} />
              )}
              Ödemeye Devam Et
            </button>
          ) : null}
        </div>

        {paytrForm &&
        paytrForm.mode !== "iframe" &&
        paytrForm.actionUrl &&
        paytrForm.fields ? (
          <div className="border-t border-slate-100 px-4 py-4">
            <p className="mb-3 text-[12px] font-black text-[#0f1f4d]">
              Kart Bilgileri
            </p>
            <form
              action={paytrForm.actionUrl}
              method="POST"
              className="grid gap-2 sm:grid-cols-2"
            >
              {Object.entries(paytrForm.fields).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
              <input
                name="cc_owner"
                autoComplete="cc-name"
                placeholder="Kart sahibi"
                className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-300"
                required
              />
              <input
                name="card_number"
                autoComplete="cc-number"
                inputMode="numeric"
                placeholder="Kart numarası"
                className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-300"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="expiry_month"
                  autoComplete="cc-exp-month"
                  inputMode="numeric"
                  placeholder="Ay"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-300"
                  required
                />
                <input
                  name="expiry_year"
                  autoComplete="cc-exp-year"
                  inputMode="numeric"
                  placeholder="Yıl"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-300"
                  required
                />
              </div>
              <input
                name="cvv"
                autoComplete="cc-csc"
                inputMode="numeric"
                placeholder="CVV"
                className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold outline-none focus:border-blue-300"
                required
              />
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] text-[12px] font-black text-white sm:w-auto sm:px-6"
                >
                  <Check size={14} />
                  3D Secure ile Öde
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      <details className="group rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-[13px] font-black text-[#0f1f4d]">Ödeme Geçmişi</p>
            <p className="text-[11px] text-slate-500">
              {formatNumber(data.payments.length)} kayıt
              {data.lastPayment
                ? ` · Son: ${formatMoney(data.lastPayment.amount)}`
                : ""}
            </p>
          </div>
          <ChevronDown
            size={16}
            className="text-slate-400 transition group-open:rotate-180"
          />
        </summary>

        {data.payments.length === 0 ? (
          <p className="border-t border-slate-100 px-4 py-6 text-center text-[12px] text-slate-500">
            Henüz ödeme kaydı yok.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[10px] font-black uppercase text-slate-400">
                  <th className="px-4 py-2">Dönem</th>
                  <th className="px-4 py-2">Tutar</th>
                  <th className="px-4 py-2">Durum</th>
                  <th className="px-4 py-2">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="text-[12px] font-semibold text-[#24345f]"
                  >
                    <td className="px-4 py-2.5 font-bold text-[#0f1f4d]">
                      {payment.periodLabel}
                    </td>
                    <td className="px-4 py-2.5">{formatMoney(payment.amount)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={[
                          "rounded border px-1.5 py-0.5 text-[10px] font-black",
                          getStatusBadgeClass(payment.status),
                        ].join(" ")}
                      >
                        {payment.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {formatShortDisplayDate(payment.paidAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <p className="flex items-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
        {isSipayCheckout
          ? "Kart bilgileriniz Sipay güvenli ödeme sayfasında girilir; ödeme onaylandığında üyelik aktif edilir."
          : isPaytrCheckout
            ? "Kart bilgileri doğrudan PayTR'a gönderilir; callback sonrası üyelik aktif edilir."
            : "Ödeme sağlayıcısı yapılandırılmamış."}
      </p>
    </div>
  );
}
