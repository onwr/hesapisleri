"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ChevronRight,
  Loader2,
  Package,
  RefreshCw,
  TrendingUp,
  Warehouse,
  Wallet,
} from "lucide-react";
import {
  COMMAND_CATEGORIES,
  COMMAND_LABELS,
  FINANCE_ASSISTANT_PERIODS,
  PRODUCT_COMMANDS,
  PERIOD_SENSITIVE_COMMANDS,
  type FinanceAssistantCommand,
  type FinanceAssistantPeriod,
} from "@/lib/finance-assistant/commands";
import type { FinanceAssistantResult } from "@/lib/finance-assistant/response-builders";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductOption = { id: string; name: string; unitType: string };

type HistoryEntry = {
  id: string;
  command: FinanceAssistantCommand;
  commandLabel: string;
  result: FinanceAssistantResult;
  timestamp: Date;
};

type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: FinanceAssistantResult }
  | { status: "error"; message: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<FinanceAssistantPeriod, string> = {
  TODAY: "Bugün",
  THIS_WEEK: "Bu Hafta",
  THIS_MONTH: "Bu Ay",
  LAST_MONTH: "Geçen Ay",
  LAST_30_DAYS: "Son 30 Gün",
  THIS_YEAR: "Bu Yıl",
  CUSTOM: "Özel Tarih",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Satış: <TrendingUp size={13} />,
  Finans: <Wallet size={13} />,
  Ürün: <Package size={13} />,
  Stok: <Warehouse size={13} />,
};

// ─── Subcomponents ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  formattedValue,
}: {
  label: string;
  formattedValue: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-[16px] font-black text-[#0f1f4d]">{formattedValue}</p>
    </div>
  );
}

function ResultView({ result }: { result: FinanceAssistantResult }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
        <p className="text-[11px] font-extrabold text-blue-700">{result.title}</p>
        <p className="mt-1 text-[12px] font-semibold text-[#0f1f4d]">{result.message}</p>
        <p className="mt-0.5 text-[10px] font-medium text-slate-500">{result.period.label}</p>
      </div>

      {result.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {result.metrics.map((m, i) => (
            <MetricCard key={i} label={m.label} formattedValue={m.formattedValue} />
          ))}
        </div>
      )}

      {result.items.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
          <div className="divide-y divide-slate-50">
            {result.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-extrabold text-[#0f1f4d]">
                    {item.label}
                  </p>
                  {item.secondary && (
                    <p className="text-[10px] font-medium text-slate-500">{item.secondary}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-black text-emerald-600">
                  {item.formattedValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

type Props = {
  companyId?: string;
};

export function FinanceAssistantPanel({ companyId }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>("Satış");
  const [selectedCommand, setSelectedCommand] =
    useState<FinanceAssistantCommand | null>(null);
  const [selectedPeriod, setSelectedPeriod] =
    useState<FinanceAssistantPeriod>("THIS_MONTH");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [queryState, setQueryState] = useState<QueryState>({ status: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSuggestionsLoading(true);
    void fetch(
      `/api/finance-assistant/suggestions?category=${encodeURIComponent(activeCategory)}`
    )
      .then((res) => res.json())
      .then((json: { data?: { suggestions?: string[] } }) => {
        if (cancelled) return;
        setCategorySuggestions(json.data?.suggestions ?? []);
      })
      .catch(() => {
        if (!cancelled) setCategorySuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory, companyId]);

  const needsProduct = selectedCommand ? PRODUCT_COMMANDS.has(selectedCommand) : false;
  const needsPeriod = selectedCommand ? PERIOD_SENSITIVE_COMMANDS.has(selectedCommand) : false;

  // Product search
  useEffect(() => {
    if (!productSearch.trim() || productSearch.length < 1) {
      setProductOptions([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(productSearch)}&limit=10`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json.data)) {
          setProductOptions(
            json.data.map((p: { id: string; name: string; unitType?: string }) => ({
              id: p.id,
              name: p.name,
              unitType: p.unitType ?? "PIECE",
            }))
          );
        }
      } catch {
        // ignore
      }
    }, 300);
  }, [productSearch]);

  const run = useCallback(async () => {
    if (!selectedCommand) return;
    if (needsProduct && !selectedProduct) return;

    setQueryState({ status: "loading" });
    try {
      const body: Record<string, unknown> = {
        command: selectedCommand,
        period: selectedPeriod,
      };
      if (selectedProduct) body.productId = selectedProduct.id;
      if (selectedPeriod === "CUSTOM") {
        body.startDate = customStart;
        body.endDate = customEnd;
      }

      const res = await fetch("/api/finance-assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Analiz başarısız.");

      const result = json.data as FinanceAssistantResult;
      setQueryState({ status: "success", result });

      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        command: selectedCommand,
        commandLabel: COMMAND_LABELS[selectedCommand],
        result,
        timestamp: new Date(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 20));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analiz çalıştırılamadı.";
      setQueryState({ status: "error", message });
    }
  }, [selectedCommand, selectedPeriod, selectedProduct, needsProduct, customStart, customEnd]);

  const selectCommand = (cmd: FinanceAssistantCommand) => {
    setSelectedCommand(cmd);
    setSelectedProduct(null);
    setProductSearch("");
    setQueryState({ status: "idle" });
  };

  const canRun =
    !!selectedCommand &&
    (!needsProduct || !!selectedProduct) &&
    (selectedPeriod !== "CUSTOM" || (!!customStart && !!customEnd));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-4 px-4 py-3">
        {/* Category tabs */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {Object.keys(COMMAND_CATEGORIES).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={[
                "flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-extrabold transition",
                activeCategory === cat
                  ? "bg-white text-[#0f1f4d] shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {CATEGORY_ICONS[cat]}
              {cat}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
            Öneriler
          </p>
          {suggestionsLoading ? (
            <p className="mt-1 text-[11px] font-medium text-slate-500">Yükleniyor...</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {categorySuggestions.map((item) => (
                <li key={item} className="text-[11px] font-semibold text-[#0f1f4d]">
                  • {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Command cards */}
        <div className="space-y-1.5">
          {(COMMAND_CATEGORIES[activeCategory] ?? []).map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => selectCommand(cmd)}
              className={[
                "flex w-full min-h-[56px] max-h-[72px] items-center justify-between rounded-xl border px-3 py-2 text-left transition",
                selectedCommand === cmd
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-100 bg-white text-[#0f1f4d] hover:bg-slate-50",
              ].join(" ")}
            >
              <span className="text-[12px] font-extrabold">{COMMAND_LABELS[cmd]}</span>
              <ChevronRight size={14} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Product search (when needed) */}
        {needsProduct && (
          <div className="space-y-2">
            <p className="text-[11px] font-extrabold text-slate-600">Ürün Seç</p>
            <input
              type="text"
              placeholder="Ürün ara..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setSelectedProduct(null);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
            {productOptions.length > 0 && !selectedProduct && (
              <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                {productOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(p);
                      setProductSearch(p.name);
                      setProductOptions([]);
                    }}
                    className="flex w-full items-center px-3 py-2 text-left text-[12px] font-semibold text-[#0f1f4d] hover:bg-slate-50"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <Package size={12} className="text-emerald-600" />
                <span className="text-[12px] font-extrabold text-emerald-700">
                  {selectedProduct.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setProductSearch("");
                  }}
                  className="ml-auto text-[10px] font-bold text-slate-500 hover:text-slate-700"
                >
                  Değiştir
                </button>
              </div>
            )}
          </div>
        )}

        {/* Period selector */}
        {needsPeriod && (
          <div className="space-y-2">
            <p className="text-[11px] font-extrabold text-slate-600">Dönem</p>
            <div className="grid grid-cols-3 gap-1.5">
              {FINANCE_ASSISTANT_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPeriod(p)}
                  className={[
                    "rounded-lg border px-2 py-1.5 text-[10px] font-extrabold transition",
                    selectedPeriod === p
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-100 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            {selectedPeriod === "CUSTOM" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[10px] font-bold text-slate-500">Başlangıç</p>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-blue-300"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold text-slate-500">Bitiş</p>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Run button */}
        {selectedCommand && (
          <button
            type="button"
            disabled={!canRun || queryState.status === "loading"}
            onClick={run}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 py-2.5 text-[12px] font-extrabold text-white transition disabled:opacity-50"
          >
            {queryState.status === "loading" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analiz yapılıyor…
              </>
            ) : (
              <>
                <BarChart3 size={14} />
                Analiz Et
              </>
            )}
          </button>
        )}

        {/* Result */}
        {queryState.status === "success" && (
          <ResultView result={queryState.result} />
        )}

        {queryState.status === "error" && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-3">
            <p className="text-[12px] font-extrabold text-rose-700">Hata</p>
            <p className="mt-1 text-[11px] font-semibold text-rose-600">{queryState.message}</p>
            <button
              type="button"
              onClick={run}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-700 hover:underline"
            >
              <RefreshCw size={11} />
              Tekrar Dene
            </button>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-extrabold text-slate-500 hover:text-slate-700"
            >
              <ChevronRight
                size={12}
                className={`transition-transform ${showHistory ? "rotate-90" : ""}`}
              />
              Geçmiş Sorgular ({history.length})
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setQueryState({ status: "success", result: entry.result });
                      setSelectedCommand(entry.command);
                    }}
                    className="w-full rounded-xl border border-slate-100 bg-white px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <p className="text-[11px] font-extrabold text-[#0f1f4d]">
                      {entry.commandLabel}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                      {entry.result.message}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {entry.timestamp.toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
