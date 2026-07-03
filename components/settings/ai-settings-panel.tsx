"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, TestTubeDiagonal } from "lucide-react";

type SettingsPayload = {
  settings: {
    enabled: boolean;
    provider: string;
    model: string | null;
    defaultLanguage: string;
    maxResponseTokens: number;
    monthlyCostWarningUsd: number | null;
    readOnlyMode: boolean;
    requireUserApproval: boolean;
    autoDisableOnCostExceeded: boolean;
    platformModel: string;
    hasApiKey: boolean;
  };
  health: {
    status: string;
    label: string;
    message: string;
    usesRulesFallback?: boolean;
  };
  usage: {
    requestCount: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  costAlert?: {
    thresholdUsd: number | null;
    currentCostUsd: number;
    exceeded: boolean;
    autoDisableOnCostExceeded: boolean;
  };
  rateLimits?: {
    messagesLastMinute: number;
    toolCallsLastHour: number;
    dailyTokens: number;
    dailyCostUsd: number;
    limits: {
      maxMessagesPerMinute: number;
      maxToolCallsPerHour: number;
      maxDailyCostUsd: number;
      maxDailyTokens: number;
    };
  };
};

export function AiSettingsPanel() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/ai/settings");
    const result = await response.json();
    if (result.success) setData(result.data as SettingsPayload);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(patch: Partial<SettingsPayload["settings"]>) {
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ai/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message || "Ayarlar kaydedilemedi.");
        return;
      }
      await load();
      setMessage("Ayarlar kaydedildi.");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ai/test-connection", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message || "Bağlantı testi başarısız.");
        return;
      }
      setMessage(result.data?.message || "Bağlantı testi tamamlandı.");
      await load();
    } finally {
      setTesting(false);
    }
  }

  if (!data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  }

  const { settings, health, usage, costAlert, rateLimits } = data;

  return (
    <div className="space-y-5">
      {health.usesRulesFallback ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-900">
          {health.message}
        </div>
      ) : null}

      {costAlert?.exceeded ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-800">
          Aylık maliyet eşiği aşıldı ({costAlert.currentCostUsd.toFixed(4)} /{" "}
          {costAlert.thresholdUsd?.toFixed(2)} USD).
        </div>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-black text-[#0f1f4d]">
              <Sparkles size={16} />
              Yapay Zekâ Ayarları
            </h2>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Bağlantı: <span className="font-bold">{health.label}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">{health.message}</p>
          </div>
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={testing}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[11px] font-black text-slate-700"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTubeDiagonal size={14} />}
            Bağlantıyı Test Et
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[12px] font-black text-slate-500">AI Aktif</span>
          <div className="mt-2">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => void save({ enabled: event.target.checked })}
              disabled={saving}
            />
          </div>
        </label>

        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[12px] font-black text-slate-500">Salt Okunur Mod</span>
          <div className="mt-2">
            <input
              type="checkbox"
              checked={settings.readOnlyMode}
              onChange={(event) => void save({ readOnlyMode: event.target.checked })}
              disabled={saving}
            />
          </div>
        </label>

        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[12px] font-black text-slate-500">Provider</span>
          <select
            value={settings.provider}
            onChange={(event) =>
              void save({ provider: event.target.value as "openai" | "rules" })
            }
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold"
          >
            <option value="openai">OpenAI</option>
            <option value="rules">Kural Tabanlı</option>
          </select>
        </label>

        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[12px] font-black text-slate-500">Model</span>
          <input
            value={settings.model || settings.platformModel}
            onChange={(event) => void save({ model: event.target.value })}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold"
            placeholder={settings.platformModel}
          />
        </label>

        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[12px] font-black text-slate-500">Varsayılan Dil</span>
          <input
            value={settings.defaultLanguage}
            onChange={(event) => void save({ defaultLanguage: event.target.value })}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold"
          />
        </label>

        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[12px] font-black text-slate-500">Maks. Yanıt Uzunluğu</span>
          <input
            type="number"
            value={settings.maxResponseTokens}
            onChange={(event) =>
              void save({ maxResponseTokens: Number(event.target.value) })
            }
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold"
          />
        </label>

        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[12px] font-black text-slate-500">Aylık Maliyet Uyarısı (USD)</span>
          <input
            type="number"
            step="0.01"
            value={settings.monthlyCostWarningUsd ?? ""}
            onChange={(event) =>
              void save({
                monthlyCostWarningUsd: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold"
          />
        </label>

        <label className="rounded-xl border border-slate-200 bg-white p-3">
          <span className="text-[12px] font-black text-slate-500">
            Eşik Aşılınca AI&apos;yi Otomatik Kapat
          </span>
          <div className="mt-2">
            <input
              type="checkbox"
              checked={settings.autoDisableOnCostExceeded}
              onChange={(event) =>
                void save({ autoDisableOnCostExceeded: event.target.checked })
              }
              disabled={saving}
            />
          </div>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[12px] font-medium text-slate-600">
        <p>API anahtarı: {settings.hasApiKey ? "Tanımlı (sunucu ortam değişkeni)" : "Eksik"}</p>
        <p className="mt-1">
          Bu ay {usage.requestCount} istek, {usage.totalTokens} token, ~
          {usage.estimatedCostUsd.toFixed(4)} USD tahmini maliyet.
        </p>
        {settings.monthlyCostWarningUsd ? (
          <p className="mt-1">
            Aylık maliyet uyarısı: {settings.monthlyCostWarningUsd} USD
          </p>
        ) : null}
        {rateLimits ? (
          <p className="mt-1">
            Rate limit: {rateLimits.messagesLastMinute}/{rateLimits.limits.maxMessagesPerMinute} dk
            mesaj, {rateLimits.toolCallsLastHour}/{rateLimits.limits.maxToolCallsPerHour} saat araç,
            {rateLimits.dailyTokens}/{rateLimits.limits.maxDailyTokens} günlük token.
          </p>
        ) : null}
        <p className="mt-2">
          API anahtarı yalnızca sunucu tarafında `OPENAI_API_KEY` ile yapılandırılır.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-[12px] font-semibold text-blue-700">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <Link href="/settings/ai/usage" className="text-[12px] font-black text-violet-700 underline">
          Kullanım ve maliyet paneli
        </Link>
        <Link href="/ai-assistant" className="text-[12px] font-black text-blue-600 underline">
          Yapay Zekâ Asistanına git
        </Link>
      </div>
    </div>
  );
}
