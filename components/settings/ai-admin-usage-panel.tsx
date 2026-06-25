"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, Users } from "lucide-react";

type AdminStats = {
  totalRequests: number;
  failedRequests: number;
  errorRate: number;
  totalTokens: number;
  estimatedCostUsd: number;
  topTools: Array<{ name: string; count: number }>;
  byUser: Array<{
    userId: string;
    name: string;
    email: string;
    requests: number;
    tokens: number;
    costUsd: number;
    errors: number;
  }>;
  rateLimitEvents: number;
  costAlert: {
    exceeded: boolean;
    thresholdUsd: number | null;
    currentCostUsd: number;
  };
  rateLimits: {
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

export function AiAdminUsagePanel() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/ai/admin/stats")
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) {
          setError(result.message || "İstatistikler yüklenemedi.");
          return;
        }
        setData(result.data as AdminStats);
      })
      .catch(() => setError("İstatistikler yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="animate-spin text-slate-400" size={20} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13px] font-semibold text-rose-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[18px] font-black text-[#0f1f4d]">
            <Sparkles size={18} />
            AI Kullanım ve Maliyet
          </h2>
          <p className="mt-1 text-[12px] font-medium text-slate-500">
            Bu ayki istek, token ve tahmini maliyet özeti
          </p>
        </div>
        <Link
          href="/settings/ai"
          className="text-[12px] font-black text-violet-700 underline"
        >
          AI Ayarları
        </Link>
      </div>

      {data.costAlert.exceeded ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-800">
          Maliyet uyarısı aktif: {data.costAlert.currentCostUsd.toFixed(4)} /{" "}
          {data.costAlert.thresholdUsd?.toFixed(2)} USD
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Toplam İstek", value: data.totalRequests },
          { label: "Token", value: data.totalTokens.toLocaleString("tr-TR") },
          { label: "Tahmini Maliyet", value: `$${data.estimatedCostUsd.toFixed(4)}` },
          { label: "Hata Oranı", value: `%${data.errorRate}` },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-[11px] font-black uppercase text-slate-400">{card.label}</p>
            <p className="mt-2 text-[20px] font-black text-[#0f1f4d]">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-[14px] font-black text-[#0f1f4d]">En Çok Kullanılan Araçlar</h3>
          <div className="mt-3 space-y-2">
            {data.topTools.length === 0 ? (
              <p className="text-[12px] text-slate-500">Henüz araç çağrısı yok.</p>
            ) : (
              data.topTools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <span className="text-[12px] font-bold text-[#0f1f4d]">{tool.name}</span>
                  <span className="text-[11px] font-black text-violet-700">{tool.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-[14px] font-black text-[#0f1f4d]">Rate Limit</h3>
          <div className="mt-3 space-y-2 text-[12px] font-medium text-slate-600">
            <p>
              Dakika mesaj: {data.rateLimits.messagesLastMinute}/
              {data.rateLimits.limits.maxMessagesPerMinute}
            </p>
            <p>
              Saat araç: {data.rateLimits.toolCallsLastHour}/
              {data.rateLimits.limits.maxToolCallsPerHour}
            </p>
            <p>
              Günlük token: {data.rateLimits.dailyTokens}/
              {data.rateLimits.limits.maxDailyTokens}
            </p>
            <p>
              Günlük maliyet: ${data.rateLimits.dailyCostUsd}/
              {data.rateLimits.limits.maxDailyCostUsd}
            </p>
            <p className="font-bold text-amber-700">
              Rate limit olayları: {data.rateLimitEvents}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="flex items-center gap-2 text-[14px] font-black text-[#0f1f4d]">
          <Users size={16} />
          Kullanıcı Bazlı Kullanım
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">İstek</th>
                <th className="px-3 py-2">Token</th>
                <th className="px-3 py-2">Maliyet</th>
                <th className="px-3 py-2">Hata</th>
              </tr>
            </thead>
            <tbody>
              {data.byUser.map((user) => (
                <tr key={user.userId} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-bold text-[#0f1f4d]">{user.name}</td>
                  <td className="px-3 py-2">{user.requests}</td>
                  <td className="px-3 py-2">{user.tokens}</td>
                  <td className="px-3 py-2">${user.costUsd.toFixed(4)}</td>
                  <td className="px-3 py-2">{user.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
