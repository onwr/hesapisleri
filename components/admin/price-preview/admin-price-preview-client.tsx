"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appInputClass,
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
} from "@/lib/admin-ui";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import type { getPricePreviewOptions } from "@/lib/admin/price-preview";

type Options = Awaited<ReturnType<typeof getPricePreviewOptions>>;

type PreviewResult = {
  primary: Record<string, unknown>;
  secondary?: Record<string, unknown>;
  comparison?: Record<string, unknown> | null;
};

type AddOnRow = { addOnId: string; quantity: number };

const SCENARIO_LABELS: Record<string, string> = {
  NEW_SUBSCRIPTION: "Yeni abonelik",
  RENEWAL: "Yenileme",
  PLAN_CHANGE: "Plan değişikliği",
};

const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

export function AdminPricePreviewClient({
  options,
  initialParams,
}: {
  options: Options;
  initialParams: {
    planId: string;
    billingInterval: string;
    currency: string;
    scenario: string;
    companyId: string;
  };
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [planId, setPlanId] = useState(initialParams.planId || options.plans[0]?.id || "");
  const [billingInterval, setBillingInterval] = useState(initialParams.billingInterval);
  const [currency, setCurrency] = useState(
    initialParams.currency ||
      options.plans.find((p) => p.id === planId)?.defaultCurrency ||
      "TRY"
  );
  const [scenario, setScenario] = useState(initialParams.scenario);
  const [companyId, setCompanyId] = useState(initialParams.companyId);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [debouncedCoupon, setDebouncedCoupon] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [addOnRows, setAddOnRows] = useState<AddOnRow[]>([]);
  const [planChangeApplyAt, setPlanChangeApplyAt] = useState<"IMMEDIATELY" | "NEXT_PERIOD">(
    "IMMEDIATELY"
  );
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparePlanId, setComparePlanId] = useState("");
  const [compareInterval, setCompareInterval] = useState("MONTHLY");
  const [compareScenario, setCompareScenario] = useState("NEW_SUBSCRIPTION");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);

  const selectedPlan = useMemo(
    () => options.plans.find((p) => p.id === planId),
    [options.plans, planId]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedCoupon(couponCode.trim()), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [couponCode]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (planId) params.set("planId", planId);
    params.set("billingInterval", billingInterval);
    if (currency) params.set("currency", currency);
    params.set("scenario", scenario);
    if (companyId) params.set("companyId", companyId);
    const next = params.toString();
    const current =
      typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    if (next !== current) {
      router.replace(`/admin/price-preview?${next}`, { scroll: false });
    }
  }, [planId, billingInterval, currency, scenario, companyId, router]);

  const buildPayload = useCallback(
    (overrides?: Partial<Record<string, unknown>>) => {
      const payload: Record<string, unknown> = {
        effectiveDate: new Date(effectiveDate).toISOString(),
        planId,
        billingInterval,
        currency: currency || undefined,
        scenario,
        companyId: companyId || null,
        subscriptionId: subscriptionId || null,
        couponCode: debouncedCoupon || null,
        campaignId: campaignId || null,
        addOns: addOnRows.length ? addOnRows : undefined,
        planChangeApplyAt: scenario === "PLAN_CHANGE" ? planChangeApplyAt : undefined,
        ...overrides,
      };
      return payload;
    },
    [
      effectiveDate,
      planId,
      billingInterval,
      currency,
      scenario,
      companyId,
      subscriptionId,
      debouncedCoupon,
      campaignId,
      addOnRows,
      planChangeApplyAt,
    ]
  );

  async function runPreview() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const body = buildPayload();
      if (compareEnabled && comparePlanId) {
        body.compareWith = {
          effectiveDate: new Date(effectiveDate).toISOString(),
          planId: comparePlanId,
          billingInterval: compareInterval,
          currency: currency || undefined,
          scenario: compareScenario,
          companyId: companyId || null,
        };
      }
      const res = await fetch("/api/admin/price-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Önizleme başarısız.");
        setResult(null);
        return;
      }
      setResult(json.data as PreviewResult);
    } catch {
      setError("İstek başarısız.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleAddOn(addOnId: string) {
    setAddOnRows((rows) => {
      const exists = rows.find((r) => r.addOnId === addOnId);
      if (exists) return rows.filter((r) => r.addOnId !== addOnId);
      return [...rows, { addOnId, quantity: 1 }];
    });
  }

  function setAddOnQty(addOnId: string, quantity: number) {
    setAddOnRows((rows) =>
      rows.map((r) => (r.addOnId === addOnId ? { ...r, quantity } : r))
    );
  }

  const primary = result?.primary as Record<string, unknown> | undefined;
  const plan = primary?.plan as Record<string, unknown> | null | undefined;
  const breakdown = (primary?.breakdown as Array<Record<string, unknown>>) ?? [];
  const issues = (primary?.issues as Array<Record<string, unknown>>) ?? [];
  const addOns = (primary?.addOns as Array<Record<string, unknown>>) ?? [];
  const stacking = (primary?.stacking as Array<Record<string, unknown>>) ?? [];
  const totals = primary?.totals as Record<string, number> | undefined;
  const subCtx = primary?.subscriptionContext as Record<string, unknown> | null | undefined;

  return (
    <AdminPageContainer size="wide">
      <AdminPageHeader
        title="Merkezi Fiyat Önizleme"
        description="Plan, kampanya, kupon ve add-on fiyatlandırmasını gerçek resolver'larla simüle edin. Hiçbir finansal kayıt oluşturulmaz."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${appPanelClass} space-y-4 p-5`}>
          <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">Senaryo</h2>

          <label className="block text-[12px]">
            Fiyat tarihi
            <input
              type="datetime-local"
              className={`${appInputClass} mt-1 w-full`}
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </label>

          <label className="block text-[12px]">
            Plan
            <select
              className={`${appSelectClass} mt-1 w-full`}
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                const p = options.plans.find((x) => x.id === e.target.value);
                if (p) setCurrency(p.defaultCurrency || p.currency);
              }}
            >
              {options.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px]">
              Dönem
              <select
                className={`${appSelectClass} mt-1 w-full`}
                value={billingInterval}
                onChange={(e) => setBillingInterval(e.target.value)}
              >
                {options.intervals.map((i) => (
                  <option key={i} value={i}>
                    {INTERVAL_LABELS[i] ?? i}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px]">
              Para birimi
              <select
                className={`${appSelectClass} mt-1 w-full`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {options.currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-[12px]">
            Senaryo
            <select
              className={`${appSelectClass} mt-1 w-full`}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {options.scenarios.map((s) => (
                <option key={s} value={s}>
                  {SCENARIO_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </label>

          {scenario === "PLAN_CHANGE" ? (
            <label className="block text-[12px]">
              Geçerlilik
              <select
                className={`${appSelectClass} mt-1 w-full`}
                value={planChangeApplyAt}
                onChange={(e) =>
                  setPlanChangeApplyAt(e.target.value as "IMMEDIATELY" | "NEXT_PERIOD")
                }
              >
                <option value="IMMEDIATELY">Hemen</option>
                <option value="NEXT_PERIOD">Sonraki dönem</option>
              </select>
            </label>
          ) : null}

          <label className="block text-[12px]">
            Firma (opsiyonel)
            <select
              className={`${appSelectClass} mt-1 w-full`}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Anonim checkout</option>
              {options.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {companyId ? (
            <label className="block text-[12px]">
              Abonelik ID (opsiyonel)
              <input
                className={`${appInputClass} mt-1 w-full font-mono text-[11px]`}
                value={subscriptionId}
                onChange={(e) => setSubscriptionId(e.target.value)}
                placeholder="UUID"
              />
            </label>
          ) : null}

          <label className="block text-[12px]">
            Kupon kodu (opsiyonel)
            <input
              className={`${appInputClass} mt-1 w-full font-mono`}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
          </label>

          <label className="block text-[12px]">
            Kampanya (opsiyonel)
            <select
              className={`${appSelectClass} mt-1 w-full`}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              disabled={!companyId}
            >
              <option value="">Otomatik uygun kampanyalar</option>
              {options.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.autoApply ? "(otomatik)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="text-[12px]">
            <p className="mb-2 font-bold text-slate-700">Add-on seçimi</p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded border border-slate-100 p-2">
              {options.addOns.length === 0 ? (
                <p className="text-slate-500">Aktif add-on yok.</p>
              ) : (
                options.addOns.map((a) => {
                  const row = addOnRows.find((r) => r.addOnId === a.id);
                  return (
                    <div key={a.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(row)}
                        onChange={() => toggleAddOn(a.id)}
                      />
                      <span className="flex-1 truncate">
                        {a.name} ({a.currency})
                      </span>
                      {row ? (
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className={`${appInputClass} w-16`}
                          value={row.quantity}
                          onChange={(e) => setAddOnQty(a.id, Number(e.target.value))}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
            />
            Karşılaştır modu (Senaryo B)
          </label>

          {compareEnabled ? (
            <div className="space-y-2 rounded border border-slate-100 bg-slate-50 p-3 text-[12px]">
              <label className="block">
                Plan B
                <select
                  className={`${appSelectClass} mt-1 w-full`}
                  value={comparePlanId}
                  onChange={(e) => setComparePlanId(e.target.value)}
                >
                  <option value="">Seçin</option>
                  {options.plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Dönem B
                <select
                  className={`${appSelectClass} mt-1 w-full`}
                  value={compareInterval}
                  onChange={(e) => setCompareInterval(e.target.value)}
                >
                  {options.intervals.map((i) => (
                    <option key={i} value={i}>
                      {INTERVAL_LABELS[i] ?? i}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Senaryo B
                <select
                  className={`${appSelectClass} mt-1 w-full`}
                  value={compareScenario}
                  onChange={(e) => setCompareScenario(e.target.value)}
                >
                  {options.scenarios.map((s) => (
                    <option key={s} value={s}>
                      {SCENARIO_LABELS[s] ?? s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <button
            type="button"
            className={appPrimaryButtonClass}
            disabled={loading || !planId}
            onClick={runPreview}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Hesaplanıyor…
              </>
            ) : (
              "Önizle"
            )}
          </button>
        </div>

        <div className="space-y-4">
          {error ? (
            <div className={`${appPanelClass} p-4 text-[13px] text-red-700`}>{error}</div>
          ) : null}

          {!result && !loading && !error ? (
            <div className={`${appPanelClass} p-8 text-center text-[13px] text-slate-500`}>
              Senaryoyu doldurup Önizle&apos;ye tıklayın.
            </div>
          ) : null}

          {primary ? (
            <>
              <div className={`${appPanelClass} p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">Fiyat dökümü</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      primary.eligible
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    {primary.eligible ? "Uygun" : "Uygun değil"}
                  </span>
                </div>

                {plan ? (
                  <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
                    <Row label="Plan" value={String(plan.name)} />
                    <Row label="Fiyat kaynağı" value={String(plan.priceSource)} />
                    <Row
                      label="planPriceId / v"
                      value={`${String(plan.planPriceId).slice(0, 12)}… / v${plan.priceVersion}`}
                    />
                    <Row label="Liste" value={formatMinorToMoney(Number(plan.listPriceMinor), String(plan.currency))} />
                    <Row label="Satış" value={formatMinorToMoney(Number(plan.salePriceMinor), String(plan.currency))} />
                    <Row label="KDV" value={formatMinorToMoney(Number(plan.vatMinor), String(plan.currency))} />
                    <Row label="Toplam" value={formatMinorToMoney(Number(plan.totalMinor), String(plan.currency))} />
                    <Row
                      label="Aylık karşılık"
                      value={formatMinorToMoney(
                        Number(plan.monthlyEquivalentMinor),
                        String(plan.currency)
                      )}
                    />
                  </dl>
                ) : (
                  <p className="mt-3 text-[13px] text-slate-500">Plan fiyatı çözümlenemedi.</p>
                )}

                {breakdown.length > 0 ? (
                  <ol className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[12px]">
                    {breakdown.map((step) => (
                      <li key={String(step.key)} className="flex justify-between gap-2">
                        <span className="text-slate-600">
                          {String(step.order)}. {String(step.label)}
                        </span>
                        <span className="font-semibold">
                          {formatMinorToMoney(
                            Number(step.amountMinor),
                            String(step.currency ?? plan?.currency ?? currency)
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}

                {totals ? (
                  <p className="mt-3 text-[13px] font-bold text-[#0f1f4d]">
                    Genel toplam (plan + add-on):{" "}
                    {formatMinorToMoney(
                      totals.grandTotalMinor,
                      String(totals.currency ?? currency)
                    )}
                  </p>
                ) : null}
              </div>

              {stacking.length > 0 ? (
                <div className={`${appPanelClass} p-5 text-[12px]`}>
                  <h3 className="font-extrabold text-[#0f1f4d]">Stacking sırası</h3>
                  <ul className="mt-2 space-y-1">
                    {stacking.map((s) => (
                      <li key={`${s.position}-${s.type}`}>
                        {String(s.position)}. {String(s.type)} — {String(s.label)} (−
                        {formatMinorToMoney(Number(s.amountMinor), String(plan?.currency ?? currency))})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {addOns.length > 0 ? (
                <div className={`${appPanelClass} p-5 text-[12px]`}>
                  <h3 className="font-extrabold text-[#0f1f4d]">Add-on satırları</h3>
                  <ul className="mt-2 space-y-2">
                    {addOns.map((a) => (
                      <li key={String(a.addOnId)} className="rounded border border-slate-100 px-3 py-2">
                        <p className="font-bold">{String(a.name)} × {String(a.quantity)}</p>
                        <p>
                          Birim: {formatMinorToMoney(Number(a.unitSaleMinor), String(a.currency))} · Toplam:{" "}
                          {formatMinorToMoney(Number(a.totalMinor), String(a.currency))}
                        </p>
                        {a.entitlement ? (
                          <p className="text-slate-500">
                            Entitlement: {String((a.entitlement as Record<string, unknown>).code)}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {subCtx ? (
                <div className={`${appPanelClass} p-5 text-[12px]`}>
                  <h3 className="font-extrabold text-[#0f1f4d]">Abonelik bağlamı</h3>
                  <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                    <Row label="Kilitli fiyat" value={subCtx.lockedPriceMinor != null ? String(subCtx.lockedPriceMinor) : "—"} />
                    <Row label="Kilit tipi" value={String(subCtx.priceLockType ?? "—")} />
                    <Row label="Sonraki fiyat ID" value={String(subCtx.nextPlanPriceId ?? "—")} />
                    <Row label="Sonraki geçerlilik" value={String(subCtx.nextPriceEffectiveAt ?? "—")} />
                  </dl>
                </div>
              ) : null}

              {issues.length > 0 ? (
                <div className={`${appPanelClass} p-5 text-[12px]`}>
                  <h3 className="font-extrabold text-[#0f1f4d]">Uyarılar / sorunlar</h3>
                  <ul className="mt-2 space-y-1">
                    {issues.map((issue, idx) => (
                      <li
                        key={`${issue.code}-${idx}`}
                        className={
                          issue.severity === "error" ? "text-red-700" : "text-amber-800"
                        }
                      >
                        <span className="font-mono text-[10px]">{String(issue.code)}</span>:{" "}
                        {String(issue.message)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result?.comparison ? (
                <div className={`${appPanelClass} p-5 text-[12px]`}>
                  <h3 className="font-extrabold text-[#0f1f4d]">Karşılaştırma (A vs B)</h3>
                  {(result.comparison as Record<string, unknown>).comparable === false ? (
                    <p className="mt-2 text-amber-800">
                      {String((result.comparison as Record<string, unknown>).message)}
                    </p>
                  ) : (
                    <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                      <Row
                        label="Fiyat farkı"
                        value={formatMinorToMoney(
                          Number((result.comparison as Record<string, unknown>).priceDiffMinor ?? 0),
                          currency
                        )}
                      />
                      <Row
                        label="Yüzde fark"
                        value={`${(result.comparison as Record<string, unknown>).percentDiff ?? "—"}%`}
                      />
                      <Row
                        label="Aylık fark"
                        value={formatMinorToMoney(
                          Number((result.comparison as Record<string, unknown>).monthlyDiffMinor ?? 0),
                          currency
                        )}
                      />
                    </dl>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </AdminPageContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-[#0f1f4d]">{value}</dd>
    </div>
  );
}
