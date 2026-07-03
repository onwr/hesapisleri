"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminPlanInfoTip } from "@/components/admin/plans/admin-plan-info-tip";
import { appOutlineButtonClass, appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import {
  buildEntitlementsPayload,
  defaultSelectedFeatures,
  defaultSelectedLimits,
  FEATURE_UI_GROUPS,
  formatCurrencyAmount,
  formatSalesStatusLabel,
  formatSelectionSummary,
  getLimitsLinkedToFeature,
  LIMIT_UI_GROUPS,
  RECOMMENDED_FEATURE_CODES,
  slugFromPlanName,
} from "@/lib/admin/plans/admin-plan-form-utils";
import {
  DEFAULT_PERIOD_DISCOUNTS,
  moneyToMinor,
  parsePlanMoneyInput,
  PERIOD_UI_LABELS,
  PLAN_BILLING_PERIODS,
  type PlanBillingPeriod,
  calculatePeriodPriceFromDiscount,
  minorToDisplayAmount,
} from "@/lib/admin/plans/admin-plan-period-pricing-utils";
import { ENTITLEMENT_REGISTRY } from "@/lib/billing/entitlements/entitlement-registry";

const compactInputClass =
  "mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-[#0f1f4d] outline-none focus:border-blue-300";
const compactBtnClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-[#0f1f4d] hover:bg-slate-50 disabled:opacity-50";
const sectionTitleClass = "text-[13px] font-black text-[#0f1f4d]";

type PeriodFormState = {
  enabled: boolean;
  discountPercent: number;
  useManualTotal: boolean;
  manualTotalInput: string;
};

function newClientRequestId() {
  return `create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultPeriodState(interval: PlanBillingPeriod): PeriodFormState {
  if (interval === "MONTHLY") {
    return { enabled: true, discountPercent: 0, useManualTotal: false, manualTotalInput: "" };
  }
  return {
    enabled: true,
    discountPercent: DEFAULT_PERIOD_DISCOUNTS[interval],
    useManualTotal: false,
    manualTotalInput: "",
  };
}

function friendlyError(message: string) {
  if (message.includes("defaultCurrency")) {
    return "Para birimi bilgisi işlenemedi. Lütfen tekrar deneyin.";
  }
  return message;
}

export function AdminPlanCreateForm({ planId }: { planId?: string } = {}) {
  const router = useRouter();
  const isEdit = Boolean(planId);
  const [loadingPlan, setLoadingPlan] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [clientRequestId] = useState(newClientRequestId);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [featureSearch, setFeatureSearch] = useState("");
  const [limitSearch, setLimitSearch] = useState("");
  const [openLimitGroups, setOpenLimitGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LIMIT_UI_GROUPS.map((g) => [g.key, true]))
  );

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(100);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [trialDays, setTrialDays] = useState(14);
  const [isFeatured, setIsFeatured] = useState(false);
  const [salesOpen, setSalesOpen] = useState(true);
  const [currency, setCurrency] = useState<"TRY" | "USD" | "EUR">("TRY");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [monthlyPriceInput, setMonthlyPriceInput] = useState("");
  const [periods, setPeriods] = useState<Record<PlanBillingPeriod, PeriodFormState>>(() =>
    Object.fromEntries(
      PLAN_BILLING_PERIODS.map((p) => [p, defaultPeriodState(p)])
    ) as Record<PlanBillingPeriod, PeriodFormState>
  );

  const [selectedFeatures, setSelectedFeatures] = useState(defaultSelectedFeatures);
  const [selectedLimits, setSelectedLimits] = useState(defaultSelectedLimits);
  const [entitlementBaseVersion, setEntitlementBaseVersion] = useState(0);
  const [currentPriceIds, setCurrentPriceIds] = useState<Partial<Record<PlanBillingPeriod, string>>>({});

  const markDirty = useCallback(() => setDirty(true), []);

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    async function loadPlan() {
      setLoadingPlan(true);
      setError(null);
      try {
        const [overviewRes, entRes] = await Promise.all([
          fetch(`/api/admin/plans/${planId}?tab=overview`),
          fetch(`/api/admin/plans/${planId}?tab=entitlements`),
        ]);
        const overviewJson = await overviewRes.json();
        const entJson = await entRes.json();
        if (!overviewJson.success) throw new Error(overviewJson.message ?? "Plan yüklenemedi.");

        const basics = overviewJson.data.plan as Record<string, unknown>;
        const tab = overviewJson.data.tabData as {
          prices?: Array<{
            id: string;
            billingInterval: PlanBillingPeriod;
            salePriceMinor: number;
            listPriceMinor: number;
            status: string;
          }>;
        };

        if (cancelled) return;
        setName(String(basics.name ?? ""));
        setShortDescription(String(basics.shortDescription ?? ""));
        setSortOrder(Number(basics.sortOrder ?? 100));
        setTrialEnabled(Boolean(basics.trialEnabled));
        setTrialDays(Number(basics.trialDays ?? 14));
        setIsFeatured(Boolean(basics.isFeatured));
        setSalesOpen(
          basics.planStatus === "ACTIVE" &&
            Boolean(basics.isActiveLegacy ?? basics.isActive)
        );
        setCurrency(
          String(basics.defaultCurrency ?? basics.currency ?? "TRY") as "TRY" | "USD" | "EUR"
        );
        setCode(String(basics.code ?? ""));
        setCodeTouched(true);

        const activePrices = (tab.prices ?? []).filter(
          (p) => p.status === "ACTIVE" || p.status === "SCHEDULED"
        );
        const monthly = activePrices.find((p) => p.billingInterval === "MONTHLY");
        if (monthly) {
          setMonthlyPriceInput(String(monthly.salePriceMinor / 100).replace(".", ","));
        }

        const nextPeriods = Object.fromEntries(
          PLAN_BILLING_PERIODS.map((p) => [p, defaultPeriodState(p)])
        ) as Record<PlanBillingPeriod, PeriodFormState>;
        const nextPriceIds: Partial<Record<PlanBillingPeriod, string>> = {};
        for (const interval of PLAN_BILLING_PERIODS) {
          if (interval === "MONTHLY") continue;
          const row = activePrices.find((p) => p.billingInterval === interval);
          if (!row) {
            nextPeriods[interval] = { ...nextPeriods[interval], enabled: false };
            continue;
          }
          nextPriceIds[interval] = row.id;
          const discount =
            row.listPriceMinor > 0
              ? Math.round(
                  ((row.listPriceMinor - row.salePriceMinor) / row.listPriceMinor) * 1000
                ) / 10
              : 0;
          nextPeriods[interval] = {
            enabled: true,
            discountPercent: discount,
            useManualTotal: false,
            manualTotalInput: "",
          };
        }
        setPeriods(nextPeriods);
        setCurrentPriceIds(nextPriceIds);

        if (entJson.success) {
          const entData = entJson.data.tabData as {
            baseVersion?: number;
            rows?: Array<{ code: string; enabled?: boolean }>;
          };
          setEntitlementBaseVersion(entData.baseVersion ?? 0);
          const features = new Set<string>();
          const limits = new Set<string>();
          for (const row of entData.rows ?? []) {
            if (row.enabled === false) continue;
            if (FEATURE_UI_GROUPS.some((g) => g.codes.includes(row.code))) {
              features.add(row.code);
            }
            if (LIMIT_UI_GROUPS.some((g) => g.codes.includes(row.code))) {
              limits.add(row.code);
            }
          }
          if (features.size) setSelectedFeatures(features);
          if (limits.size) setSelectedLimits(limits);
        }
        setDirty(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Plan yüklenemedi.");
        }
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    }
    void loadPlan();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  useEffect(() => {
    if (!codeTouched) {
      setCode(slugFromPlanName(name));
    }
  }, [name, codeTouched]);

  const monthlyMinor = useMemo(() => {
    const parsed = parsePlanMoneyInput(monthlyPriceInput);
    return parsed ? moneyToMinor(parsed) : null;
  }, [monthlyPriceInput]);

  const periodCalculations = useMemo(() => {
    const result: Partial<
      Record<
        PlanBillingPeriod,
        { normalTotal: number; saleTotal: number; monthlyEq: number; discount: number }
      >
    > = {};
    if (!monthlyMinor) return result;

    for (const interval of PLAN_BILLING_PERIODS) {
      const state = periods[interval];
      if (!state.enabled) continue;
      if (interval === "MONTHLY") {
        result.MONTHLY = {
          normalTotal: minorToDisplayAmount(monthlyMinor),
          saleTotal: minorToDisplayAmount(monthlyMinor),
          monthlyEq: minorToDisplayAmount(monthlyMinor),
          discount: 0,
        };
        continue;
      }

      try {
        if (state.useManualTotal) {
          const manual = parsePlanMoneyInput(state.manualTotalInput);
          if (!manual) continue;
          const manualMinor = moneyToMinor(manual);
          const listMinor = monthlyMinor * (interval === "QUARTERLY" ? 3 : interval === "SEMI_ANNUAL" ? 6 : 12);
          const discount = listMinor > 0 ? ((listMinor - manualMinor) / listMinor) * 100 : 0;
          result[interval] = {
            normalTotal: minorToDisplayAmount(listMinor),
            saleTotal: manual,
            monthlyEq: manual / (interval === "QUARTERLY" ? 3 : interval === "SEMI_ANNUAL" ? 6 : 12),
            discount: Math.round(discount * 10) / 10,
          };
        } else {
          const calc = calculatePeriodPriceFromDiscount({
            monthlyPriceMinor: monthlyMinor,
            interval,
            discountPercent: state.discountPercent,
          });
          const months = interval === "QUARTERLY" ? 3 : interval === "SEMI_ANNUAL" ? 6 : 12;
          result[interval] = {
            normalTotal: minorToDisplayAmount(calc.listPriceMinor),
            saleTotal: minorToDisplayAmount(calc.salePriceMinor),
            monthlyEq: minorToDisplayAmount(calc.salePriceMinor) / months,
            discount: calc.discountPercent,
          };
        }
      } catch {
        // UI validation on submit
      }
    }
    return result;
  }, [monthlyMinor, periods]);

  function updatePeriod(interval: PlanBillingPeriod, patch: Partial<PeriodFormState>) {
    markDirty();
    setPeriods((prev) => ({ ...prev, [interval]: { ...prev[interval], ...patch } }));
  }

  function toggleFeature(codeKey: string) {
    markDirty();
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(codeKey)) {
        next.delete(codeKey);
        const linked = getLimitsLinkedToFeature(codeKey);
        setSelectedLimits((limits) => {
          const copy = new Set(limits);
          for (const l of linked) copy.delete(l);
          return copy;
        });
      } else {
        next.add(codeKey);
      }
      return next;
    });
  }

  function toggleLimit(codeKey: string) {
    markDirty();
    setSelectedLimits((prev) => {
      const next = new Set(prev);
      if (next.has(codeKey)) next.delete(codeKey);
      else next.add(codeKey);
      return next;
    });
  }

  function setAllFeatures(codes: string[], on: boolean) {
    markDirty();
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (on) next.add(c);
        else next.delete(c);
      }
      return next;
    });
  }

  function setAllLimits(codes: string[], on: boolean) {
    markDirty();
    setSelectedLimits((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (on) next.add(c);
        else next.delete(c);
      }
      return next;
    });
  }

  function handleCancel() {
    if (dirty && !window.confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam edilsin mi?")) {
      return;
    }
    router.push("/admin/plans");
  }

  function validateClient(): string | null {
    if (name.trim().length < 2) return "Plan adı en az 2 karakter olmalıdır.";
    if (!monthlyMinor) return "Geçerli bir aylık fiyat girin.";
    const normalizedCode = slugFromPlanName(code || name);
    if (normalizedCode.length < 2) return "Plan kodu üretilemedi. Adı kontrol edin.";
    if (normalizedCode === "standard") return '"standard" ayrılmış plandır.';
    if (salesOpen) {
      const hasPrice = PLAN_BILLING_PERIODS.some((p) => periods[p].enabled);
      if (!hasPrice) return "Satışa açık plan için en az bir dönem fiyatı gerekir.";
    }
    for (const interval of PLAN_BILLING_PERIODS) {
      const state = periods[interval];
      if (!state.enabled || interval === "MONTHLY") continue;
      if (state.useManualTotal) {
        if (!parsePlanMoneyInput(state.manualTotalInput)) {
          return `${PERIOD_UI_LABELS[interval]} için geçerli manuel fiyat girin.`;
        }
      } else if (state.discountPercent >= 100) {
        return `${PERIOD_UI_LABELS[interval]} indirimi %100'den küçük olmalıdır.`;
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const periodPrices = PLAN_BILLING_PERIODS.map((billingInterval) => {
      const state = periods[billingInterval];
      const calc = periodCalculations[billingInterval];
      if (billingInterval === "MONTHLY") {
        return {
          billingInterval,
          enabled: true,
          salePriceMinor: monthlyMinor!,
        };
      }
      if (!state.enabled) {
        return { billingInterval, enabled: false };
      }
      if (state.useManualTotal && calc) {
        return {
          billingInterval,
          enabled: true,
          salePriceMinor: moneyToMinor(calc.saleTotal),
        };
      }
      return {
        billingInterval,
        enabled: true,
        discountPercent: state.discountPercent,
        salePriceMinor: calc ? moneyToMinor(calc.saleTotal) : undefined,
      };
    });

    const entitlements = buildEntitlementsPayload(selectedFeatures, selectedLimits);

    try {
      if (isEdit && planId) {
        const patchRes = await fetch(`/api/admin/plans/${planId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            shortDescription: shortDescription.trim() || null,
            sortOrder,
            trialEnabled,
            trialDays,
            isFeatured,
          }),
        });
        const patchJson = await patchRes.json();
        if (!patchJson.success) throw new Error(patchJson.message ?? "Plan güncellenemedi.");

        const entRes = await fetch(`/api/admin/plans/${planId}/entitlements/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entitlements,
            baseVersion: entitlementBaseVersion,
            reason: "Plan düzenleme",
            changePolicy: "NEW_SUBSCRIBERS_ONLY",
          }),
        });
        const entJson = await entRes.json();
        if (!entJson.success) throw new Error(entJson.message ?? "Yetkiler güncellenemedi.");

        const nowIso = new Date().toISOString();
        for (const row of periodPrices) {
          if (!row.enabled) continue;
          const calc = periodCalculations[row.billingInterval as PlanBillingPeriod];
          if (!calc) continue;
          const listMinor =
            row.billingInterval === "MONTHLY"
              ? moneyToMinor(calc.saleTotal)
              : moneyToMinor(calc.normalTotal);
          const saleMinor = moneyToMinor(calc.saleTotal);
          const publishRes = await fetch(`/api/admin/plans/${planId}/prices/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: "Plan düzenleme — dönem fiyatı",
              expectedCurrentPriceId:
                currentPriceIds[row.billingInterval as PlanBillingPeriod] ?? null,
              price: {
                billingInterval: row.billingInterval,
                currency,
                listPrice: listMinor / 100,
                salePrice: saleMinor / 100,
                listPriceMinor: listMinor,
                salePriceMinor: saleMinor,
                effectiveFrom: nowIso,
                priceChangePolicy: "NEW_SUBSCRIBERS_ONLY",
                isPublic: salesOpen,
                isAutoRenewEnabled: true,
              },
            }),
          });
          const publishJson = await publishRes.json();
          if (!publishJson.success) {
            throw new Error(publishJson.message ?? "Fiyat güncellenemedi.");
          }
        }

        setSuccess("Plan güncellendi.");
        setDirty(false);
        router.push(`/admin/plans/${planId}`);
        router.refresh();
        return;
      }

      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: slugFromPlanName(code || name),
          shortDescription: shortDescription.trim() || null,
          sortOrder,
          trialEnabled,
          trialDays,
          currency,
          isFeatured,
          salesOpen,
          periodPrices,
          entitlements,
          clientRequestId,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Oluşturulamadı");
      setSuccess(json.message ?? "Plan oluşturuldu.");
      setDirty(false);
      router.push(`/admin/plans/${json.data.planId}`);
      router.refresh();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Plan oluşturulamadı."));
      setSubmitting(false);
    }
  }

  const featureTotal = FEATURE_UI_GROUPS.reduce((n, g) => n + g.codes.length, 0);
  const limitTotal = LIMIT_UI_GROUPS.reduce((n, g) => n + g.codes.length, 0);

  const summaryPeriods = PLAN_BILLING_PERIODS.filter(
    (p) => periods[p].enabled && periodCalculations[p]
  );

  if (loadingPlan) {
    return (
      <AdminPageContainer size="wide">
        <p className="p-4 text-[13px] text-slate-600">Plan yükleniyor…</p>
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer size="wide">
      <AdminPageHeader
        title={isEdit ? "Planı Düzenle" : "Yeni Plan"}
        description={
          isEdit
            ? "Plan bilgileri, fiyatlandırma ve yetkileri güncelleyin."
            : "Plan bilgileri, fiyatlandırma ve yetkileri tek ekranda oluşturun."
        }
        backHref={isEdit && planId ? `/admin/plans/${planId}` : "/admin/plans"}
      />

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <section className={`${appPanelClass} p-4`}>
            <h2 className={sectionTitleClass}>Plan Bilgileri</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-semibold text-slate-600 sm:col-span-2">
                Plan adı *
                <input
                  className={compactInputClass}
                  value={name}
                  onChange={(e) => {
                    markDirty();
                    setName(e.target.value);
                  }}
                  required
                />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600 sm:col-span-2">
                Kısa açıklama
                <input
                  className={compactInputClass}
                  value={shortDescription}
                  onChange={(e) => {
                    markDirty();
                    setShortDescription(e.target.value);
                  }}
                />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">
                Ücretsiz deneme günü
                <AdminPlanInfoTip
                  className="ml-1"
                  text="Müşteri bu süre boyunca ücret ödemeden planı kullanabilir."
                />
                <input
                  type="number"
                  className={compactInputClass}
                  value={trialDays}
                  disabled={!trialEnabled}
                  onChange={(e) => {
                    markDirty();
                    setTrialDays(Number(e.target.value));
                  }}
                />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">
                Sıralama
                <input
                  type="number"
                  className={compactInputClass}
                  value={sortOrder}
                  onChange={(e) => {
                    markDirty();
                    setSortOrder(Number(e.target.value));
                  }}
                />
              </label>
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={trialEnabled}
                  onChange={(e) => {
                    markDirty();
                    setTrialEnabled(e.target.checked);
                  }}
                />
                Ücretsiz deneme
              </label>
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => {
                    markDirty();
                    setIsFeatured(e.target.checked);
                  }}
                />
                Öne çıkan plan
              </label>
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={salesOpen}
                  onChange={(e) => {
                    markDirty();
                    setSalesOpen(e.target.checked);
                  }}
                />
                Satışa açık
                <AdminPlanInfoTip text="Plan oluşturulduktan sonra fiyatlandırma ve checkout ekranlarında gösterilir." />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">
                Para birimi
                <select
                  className={compactInputClass}
                  value={currency}
                  onChange={(e) => {
                    markDirty();
                    setCurrency(e.target.value as "TRY" | "USD" | "EUR");
                  }}
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              className="mt-3 text-[11px] font-bold text-blue-600"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Gelişmiş ayarları gizle" : "Gelişmiş ayarlar"}
            </button>
            {showAdvanced ? (
              <label className="mt-2 block text-[11px] font-semibold text-slate-600">
                Plan kodu
                <input
                  className={`${compactInputClass} font-mono`}
                  value={code}
                  onChange={(e) => {
                    markDirty();
                    setCodeTouched(true);
                    setCode(e.target.value.toLowerCase());
                  }}
                />
              </label>
            ) : null}
          </section>

          <section className={`${appPanelClass} p-4`}>
            <h2 className={sectionTitleClass}>Fiyatlandırma</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Aylık fiyat zorunludur. Diğer dönemler için indirim veya manuel toplam belirleyebilirsiniz.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PLAN_BILLING_PERIODS.map((interval) => {
                const state = periods[interval];
                const calc = periodCalculations[interval];
                const isMonthly = interval === "MONTHLY";
                return (
                  <div key={interval} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-black text-[#0f1f4d]">
                        {PERIOD_UI_LABELS[interval]}
                      </p>
                      {!isMonthly ? (
                        <label className="flex items-center gap-1 text-[10px] text-slate-500">
                          <input
                            type="checkbox"
                            checked={state.enabled}
                            onChange={(e) => updatePeriod(interval, { enabled: e.target.checked })}
                          />
                          Etkin
                        </label>
                      ) : null}
                    </div>

                    {isMonthly ? (
                      <label className="mt-2 block text-[10px] font-semibold text-slate-600">
                        Aylık fiyat *
                        <input
                          className={compactInputClass}
                          value={monthlyPriceInput}
                          placeholder="500"
                          onChange={(e) => {
                            markDirty();
                            setMonthlyPriceInput(e.target.value);
                          }}
                        />
                      </label>
                    ) : state.enabled ? (
                      <div className="mt-2 space-y-2 text-[10px]">
                        {!state.useManualTotal ? (
                          <label className="block font-semibold text-slate-600">
                            İndirim %
                            <AdminPlanInfoTip
                              className="ml-1"
                              text="Aylık fiyat üzerinden ilgili dönemin normal toplamı hesaplanır ve seçilen indirim uygulanır."
                            />
                            <input
                              type="number"
                              min={0}
                              max={99.9}
                              step={0.1}
                              className={compactInputClass}
                              value={state.discountPercent}
                              onChange={(e) =>
                                updatePeriod(interval, {
                                  discountPercent: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        ) : (
                          <label className="block font-semibold text-slate-600">
                            Müşterinin ödeyeceği toplam
                            <input
                              className={compactInputClass}
                              value={state.manualTotalInput}
                              onChange={(e) =>
                                updatePeriod(interval, { manualTotalInput: e.target.value })
                              }
                            />
                          </label>
                        )}
                        <label className="flex items-center gap-2 font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={state.useManualTotal}
                            onChange={(e) =>
                              updatePeriod(interval, {
                                useManualTotal: e.target.checked,
                                manualTotalInput: "",
                              })
                            }
                          />
                          Fiyatı manuel belirle
                        </label>
                        {calc ? (
                          <div className="space-y-0.5 rounded bg-slate-50 p-2 text-slate-600">
                            <p>Normal toplam: {formatCurrencyAmount(calc.normalTotal, currency)}</p>
                            {!state.useManualTotal ? (
                              <p>İndirim: %{calc.discount}</p>
                            ) : (
                              <p>Hesaplanan indirim: %{calc.discount}</p>
                            )}
                            <p>
                              Müşterinin ödeyeceği:{" "}
                              {formatCurrencyAmount(calc.saleTotal, currency)}
                            </p>
                            <p>
                              Aylık karşılığı:{" "}
                              {formatCurrencyAmount(calc.monthlyEq, currency)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] text-slate-400">Kapalı</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`${appPanelClass} p-4`}>
            <h2 className={sectionTitleClass}>Özellikler ve Yetkiler</h2>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] font-bold text-[#0f1f4d]">Özellikler</p>
                <AdminPlanInfoTip text="Bu plandaki firmaların kullanabileceği modülleri belirler." />
                <button
                  type="button"
                  className={compactBtnClass}
                  onClick={() => setAllFeatures(FEATURE_UI_GROUPS.flatMap((g) => g.codes), true)}
                >
                  Tümünü Seç
                </button>
                <button
                  type="button"
                  className={compactBtnClass}
                  onClick={() => setAllFeatures(FEATURE_UI_GROUPS.flatMap((g) => g.codes), false)}
                >
                  Tümünü Kaldır
                </button>
                <button
                  type="button"
                  className={compactBtnClass}
                  onClick={() => setAllFeatures([...RECOMMENDED_FEATURE_CODES], true)}
                >
                  Önerilenleri Seç
                </button>
                <input
                  className="h-9 min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 text-[11px]"
                  placeholder="Özellik ara…"
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {formatSelectionSummary(selectedFeatures.size, featureTotal)}
              </p>
              <div className="mt-3 space-y-3">
                {FEATURE_UI_GROUPS.map((group) => (
                  <div key={group.key}>
                    <p className="text-[11px] font-bold text-slate-700">{group.label}</p>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      {group.codes
                        .filter((codeKey) => {
                          const meta = ENTITLEMENT_REGISTRY[codeKey];
                          if (!meta) return false;
                          const q = featureSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            meta.label.toLowerCase().includes(q) ||
                            meta.description.toLowerCase().includes(q)
                          );
                        })
                        .map((codeKey) => {
                          const meta = ENTITLEMENT_REGISTRY[codeKey]!;
                          return (
                            <label
                              key={codeKey}
                              className="flex items-start gap-2 rounded border border-slate-100 p-2 text-[11px]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedFeatures.has(codeKey)}
                                onChange={() => toggleFeature(codeKey)}
                              />
                              <span>
                                <span className="font-semibold text-[#0f1f4d]">{meta.label}</span>
                                <span className="mt-0.5 block text-slate-500">{meta.description}</span>
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] font-bold text-[#0f1f4d]">Yetkiler</p>
                <AdminPlanInfoTip text="Plan kapsamındaki kullanıcıların erişebileceği işlemleri belirler." />
                <button
                  type="button"
                  className={compactBtnClass}
                  onClick={() => setAllLimits(LIMIT_UI_GROUPS.flatMap((g) => g.codes), true)}
                >
                  Tüm Yetkileri Seç
                </button>
                <button
                  type="button"
                  className={compactBtnClass}
                  onClick={() => setAllLimits(LIMIT_UI_GROUPS.flatMap((g) => g.codes), false)}
                >
                  Tümünü Kaldır
                </button>
                <button
                  type="button"
                  className={compactBtnClass}
                  onClick={() => {
                    markDirty();
                    setSelectedLimits(new Set());
                  }}
                >
                  Salt Okuma Yetkileri
                </button>
                <input
                  className="h-9 min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 text-[11px]"
                  placeholder="Yetki ara…"
                  value={limitSearch}
                  onChange={(e) => setLimitSearch(e.target.value)}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {selectedLimits.size === limitTotal
                  ? `${limitTotal} yetkinin tamamı seçili`
                  : formatSelectionSummary(selectedLimits.size, limitTotal)}
              </p>
              <div className="mt-3 space-y-2">
                {LIMIT_UI_GROUPS.map((group) => {
                  const open = openLimitGroups[group.key] ?? true;
                  const visibleCodes = group.codes.filter((codeKey) => {
                    const meta = ENTITLEMENT_REGISTRY[codeKey];
                    if (!meta) return false;
                    const q = limitSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      meta.label.toLowerCase().includes(q) ||
                      meta.description.toLowerCase().includes(q)
                    );
                  });
                  if (!visibleCodes.length) return null;
                  return (
                    <div key={group.key} className="rounded border border-slate-100">
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] font-bold text-[#0f1f4d]"
                          onClick={() =>
                            setOpenLimitGroups((prev) => ({
                              ...prev,
                              [group.key]: !open,
                            }))
                          }
                        >
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {group.label}
                        </button>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="text-[10px] font-bold text-blue-600"
                            onClick={() => setAllLimits(group.codes, true)}
                          >
                            Tümünü seç
                          </button>
                          <button
                            type="button"
                            className="text-[10px] font-bold text-slate-500"
                            onClick={() => setAllLimits(group.codes, false)}
                          >
                            Kaldır
                          </button>
                        </div>
                      </div>
                      {open ? (
                        <div className="grid gap-1 border-t border-slate-100 p-2 sm:grid-cols-2">
                          {visibleCodes.map((codeKey) => {
                            const meta = ENTITLEMENT_REGISTRY[codeKey]!;
                            const linkedFeature = FEATURE_UI_GROUPS.flatMap((g) => g.codes).find(
                              (f) =>
                                getLimitsLinkedToFeature(f).includes(codeKey) &&
                                !selectedFeatures.has(f)
                            );
                            const disabled = Boolean(linkedFeature);
                            return (
                              <label
                                key={codeKey}
                                className={`flex items-start gap-2 rounded p-2 text-[11px] ${disabled ? "opacity-50" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedLimits.has(codeKey)}
                                  disabled={disabled}
                                  onChange={() => toggleLimit(codeKey)}
                                />
                                <span>
                                  <span className="font-semibold text-[#0f1f4d]">{meta.label}</span>
                                  <span className="mt-0.5 block text-slate-500">
                                    {meta.description}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
          {success ? <p className="text-[12px] text-emerald-700">{success}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/plans" className={appOutlineButtonClass} onClick={(e) => {
              if (dirty) {
                e.preventDefault();
                handleCancel();
              }
            }}>
              Planlara Dön
            </Link>
            <button type="button" className={appOutlineButtonClass} onClick={handleCancel}>
              İptal
            </button>
            {isEdit && planId ? (
              <Link href={`/admin/plans/${planId}`} className={appOutlineButtonClass}>
                Plan Detayına Dön
              </Link>
            ) : null}
            <button type="submit" className={appPrimaryButtonClass} disabled={submitting}>
              {submitting ? "Kaydediliyor…" : isEdit ? "Değişiklikleri Kaydet" : "Kayıt Oluştur"}
            </button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className={`${appPanelClass} p-4`}>
            <h2 className={sectionTitleClass}>Plan Özeti</h2>
            <div className="mt-3 space-y-2 text-[11px] text-slate-700">
              <p className="text-[13px] font-black text-[#0f1f4d]">{name.trim() || "Yeni Plan"}</p>
              {summaryPeriods.map((interval) => {
                const calc = periodCalculations[interval]!;
                return (
                  <p key={interval}>
                    {PERIOD_UI_LABELS[interval]}: {formatCurrencyAmount(calc.saleTotal, currency)}
                    {calc.discount > 0 ? ` — %${calc.discount} indirim` : ""}
                  </p>
                );
              })}
              {trialEnabled ? <p>Deneme: {trialDays} gün</p> : null}
              <p>
                Özellikler:{" "}
                {selectedFeatures.size === featureTotal
                  ? "Tümü seçili"
                  : formatSelectionSummary(selectedFeatures.size, featureTotal)}
              </p>
              <p>
                Yetkiler:{" "}
                {selectedLimits.size === limitTotal
                  ? "Tümü seçili"
                  : formatSelectionSummary(selectedLimits.size, limitTotal)}
              </p>
              <p>Durum: {formatSalesStatusLabel(salesOpen)}</p>
            </div>
          </div>
        </aside>
      </form>
    </AdminPageContainer>
  );
}
