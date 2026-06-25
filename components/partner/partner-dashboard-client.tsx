"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Copy,
  Loader2,
  MousePointerClick,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatMoney } from "@/lib/format-utils";
import { getPartnerBadgeClass } from "@/lib/partner-utils";
import type { PartnerBadgeType } from "@prisma/client";

type TabKey = "overview" | "clicks" | "conversions" | "earnings" | "payouts" | "profile";

type DashboardData = {
  partner: {
    fullName: string;
    email: string;
    phone?: string | null;
    referralCode: string;
    referralUrl: string;
    commissionRate: number;
    badgeType: PartnerBadgeType;
    badgeLabel: string;
    payoutInfo: {
      iban: string | null;
      bankName: string | null;
      accountHolderName: string | null;
      taxNumber?: string | null;
    };
  };
  metrics: {
    totalClicks: number;
    uniqueClicks: number;
    monthClicks: number;
    signups: number;
    monthSignups: number;
    paidCompanies: number;
    monthPaidConversions: number;
    conversionRate: number;
    pendingEarnings: number;
    approvedEarnings: number;
    paidTotal: number;
    totalEarnings: number;
    payableTotal: number;
    minimumPayoutAmount: number;
    remainingToMinPayout: number;
    canRequestPayout: boolean;
  };
  motivation: {
    monthClicksText: string;
    payoutText: string;
    signupGoalProgress: number;
    signupGoalTarget: number;
    estimatedMonthlyEarnings: number;
    partnerLevel: string;
  };
};

const cardBase =
  "rounded-[22px] border p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Genel Bakış" },
  { key: "clicks", label: "Tıklamalar" },
  { key: "conversions", label: "Dönüşümler" },
  { key: "earnings", label: "Kazançlar" },
  { key: "payouts", label: "Ödemeler" },
  { key: "profile", label: "Profil" },
];

const profilePaymentFields = [
  {
    key: "accountHolderName" as const,
    label: "Hesap sahibi adı",
    placeholder: "Banka hesabındaki ad soyad",
  },
  {
    key: "iban" as const,
    label: "IBAN",
    placeholder: "TR00 0000 0000 0000 0000 0000 00",
  },
  {
    key: "bankName" as const,
    label: "Banka adı",
    placeholder: "Örn. Ziraat Bankası",
  },
  {
    key: "taxNumber" as const,
    label: "Vergi no / T.C. kimlik no",
    placeholder: "Komisyon ödemesi için (isteğe bağlı)",
  },
  {
    key: "phone" as const,
    label: "İletişim telefonu",
    placeholder: "05xx xxx xx xx",
  },
];

const profileInputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-[#0f1f4d] outline-none transition focus:border-[#0f1f4d] focus:ring-2 focus:ring-[#0f1f4d]/10";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PartnerDashboardClient() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [clicks, setClicks] = useState<Array<Record<string, unknown>>>([]);
  const [conversions, setConversions] = useState<Array<Record<string, unknown>>>([]);
  const [earnings, setEarnings] = useState<Array<Record<string, unknown>>>([]);
  const [payouts, setPayouts] = useState<Array<Record<string, unknown>>>([]);
  const [copyDone, setCopyDone] = useState(false);
  const [profileForm, setProfileForm] = useState({
    phone: "",
    iban: "",
    bankName: "",
    accountHolderName: "",
    taxNumber: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/partner/stats");
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Panel verileri yüklenemedi.");
        return;
      }

      setData(json.data);
      setProfileForm({
        phone: json.data.partner.phone ?? "",
        iban: json.data.partner.payoutInfo.iban ?? "",
        bankName: json.data.partner.payoutInfo.bankName ?? "",
        accountHolderName: json.data.partner.payoutInfo.accountHolderName ?? "",
        taxNumber: json.data.partner.payoutInfo.taxNumber ?? "",
      });
    } catch {
      setError("Panel verileri yüklenirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTabData = useCallback(async (activeTab: TabKey) => {
    if (activeTab === "overview" || activeTab === "profile") return;

    const endpoint =
      activeTab === "clicks"
        ? "/api/partner/clicks"
        : activeTab === "conversions"
          ? "/api/partner/conversions"
          : activeTab === "earnings"
            ? "/api/partner/earnings"
            : "/api/partner/payouts";

    const res = await fetch(endpoint);
    const json = await res.json();

    if (!res.ok || !json.success) return;

    if (activeTab === "clicks") setClicks(json.data.clicks);
    if (activeTab === "conversions") setConversions(json.data.conversions);
    if (activeTab === "earnings") setEarnings(json.data.earnings);
    if (activeTab === "payouts") setPayouts(json.data.payouts);
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadTabData(tab);
  }, [tab, loadTabData]);

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);

    try {
      const res = await fetch("/api/partner/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Profil güncellenemedi.");
        return;
      }

      await loadStats();
    } catch {
      setError("Profil güncellenirken bir hata oluştu.");
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="animate-spin text-[#0f1f4d]" size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-6 text-[14px] font-semibold text-rose-700">
        {error || "Veri bulunamadı."}
      </div>
    );
  }

  const { partner, metrics, motivation } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
            Ortaklık Programı
          </p>
          <h1 className="mt-1 text-[28px] font-extrabold text-[#0f1f4d]">
            Merhaba, {partner.fullName}
          </h1>
          <p className="mt-1 text-[14px] text-slate-500">{motivation.monthClicksText}</p>
        </div>
        {partner.badgeType !== "NONE" ? (
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold ${getPartnerBadgeClass(partner.badgeType)}`}
          >
            <BadgeCheck size={16} />
            {partner.badgeLabel}
          </span>
        ) : null}
      </div>

      <div className={`${cardBase} border-cyan-200/70 bg-gradient-to-r from-cyan-50 to-white`}>
        <p className="text-[12px] font-bold text-cyan-700">Referans Linkiniz</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-xl bg-white px-4 py-2 text-[14px] font-bold text-[#0f1f4d]">
            {partner.referralUrl}
          </code>
          <button
            type="button"
            onClick={() => void copyLink(partner.referralUrl)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 py-2 text-[13px] font-bold text-white"
          >
            <Copy size={16} />
            {copyDone ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
        <p className="mt-3 text-[13px] text-slate-600">
          Kod: {partner.referralCode} · Komisyon: %{partner.commissionRate} ·{" "}
          {motivation.payoutText}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${cardBase} border-slate-200/70 bg-slate-50/60`}>
          <p className="text-[11px] font-bold uppercase text-slate-500">
            Bu Ay Hedef
          </p>
          <p className="mt-2 text-[20px] font-extrabold text-[#0f1f4d]">
            {metrics.monthSignups}/{motivation.signupGoalTarget} kayıt
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${motivation.signupGoalProgress}%` }}
            />
          </div>
        </div>
        <div className={`${cardBase} border-slate-200/70 bg-slate-50/60`}>
          <p className="text-[11px] font-bold uppercase text-slate-500">
            Tahmini Kazanç (Bu Ay)
          </p>
          <p className="mt-2 text-[20px] font-extrabold text-emerald-700">
            {formatMoney(motivation.estimatedMonthlyEarnings)}
          </p>
        </div>
        <div className={`${cardBase} border-slate-200/70 bg-slate-50/60`}>
          <p className="text-[11px] font-bold uppercase text-slate-500">
            Partner Seviyesi
          </p>
          <p className="mt-2 text-[20px] font-extrabold text-[#0f1f4d]">
            {motivation.partnerLevel}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Toplam Tıklama"
          value={metrics.totalClicks}
          subtitle={`Tekil ${metrics.uniqueClicks} · Bu ay ${metrics.monthClicks}`}
          className="border-cyan-200 bg-cyan-50 text-cyan-800"
          icon={<MousePointerClick size={18} />}
        />
        <MetricCard
          title="Kayıt Sayısı"
          value={metrics.signups}
          subtitle={`Bu ay ${metrics.monthSignups} · Dönüşüm %${metrics.conversionRate}`}
          className="border-violet-200 bg-violet-50 text-violet-800"
          icon={<TrendingUp size={18} />}
        />
        <MetricCard
          title="Ücretli Dönüşüm"
          value={metrics.paidCompanies}
          subtitle={`Bu ay ${metrics.monthPaidConversions}`}
          className="border-indigo-200 bg-indigo-50 text-indigo-800"
          icon={<TrendingUp size={18} />}
        />
        <MetricCard
          title="Toplam Kazanç"
          value={formatMoney(metrics.totalEarnings)}
          subtitle={`Bekleyen ${formatMoney(metrics.pendingEarnings + metrics.approvedEarnings)}`}
          className="border-emerald-200 bg-emerald-50 text-emerald-800"
          icon={<Wallet size={18} />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          title="Onaylanan Kazanç"
          value={formatMoney(metrics.approvedEarnings)}
          subtitle={formatMoney(metrics.payableTotal) + " ödenebilir"}
          className="border-emerald-200 bg-white text-emerald-800"
          icon={<Wallet size={18} />}
        />
        <MetricCard
          title="Ödenen Toplam"
          value={formatMoney(metrics.paidTotal)}
          subtitle={`Min. ödeme ${formatMoney(metrics.minimumPayoutAmount)}`}
          className="border-orange-200 bg-white text-orange-800"
          icon={<Wallet size={18} />}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={[
              "rounded-2xl border px-4 py-2.5 text-[13px] font-bold transition",
              tab === item.key
                ? "border-[#0f1f4d] bg-[#0f1f4d] text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className={`${cardBase} border-slate-200/70 bg-white`}>
          <p className="text-[14px] text-slate-600">
            Referans linkinizi paylaşarak yeni firmalar kazandırın. Onaylanan üyelik
            ödemelerinden komisyon kazanın.
          </p>
          {!metrics.canRequestPayout ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
              Minimum ödeme tutarına ulaşmadınız (
              {formatMoney(metrics.minimumPayoutAmount)}).
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "clicks" ? (
        <DataTable
          headers={["Tarih", "Kod", "Dönüştü"]}
          rows={clicks.map((row) => [
            formatDate(String(row.clickedAt)),
            String(row.referralCode),
            row.converted ? "Evet" : "Hayır",
          ])}
        />
      ) : null}

      {tab === "conversions" ? (
        <DataTable
          headers={["Tarih", "Tip", "Firma", "Tutar", "Komisyon", "Durum"]}
          rows={conversions.map((row) => [
            formatDate(String(row.occurredAt)),
            String(row.typeLabel),
            String(row.companyName ?? "—"),
            formatMoney(Number(row.amount)),
            formatMoney(Number(row.commissionAmount)),
            String(row.status),
          ])}
        />
      ) : null}

      {tab === "earnings" ? (
        <DataTable
          headers={["Tarih", "Tutar", "Durum", "Açıklama"]}
          rows={earnings.map((row) => [
            formatDate(String(row.createdAt)),
            formatMoney(Number(row.amount)),
            String(row.statusLabel),
            String(row.description ?? "—"),
          ])}
        />
      ) : null}

      {tab === "payouts" ? (
        <DataTable
          headers={["Tarih", "Tutar", "Yöntem", "Durum", "Not"]}
          rows={payouts.map((row) => [
            formatDate(String(row.createdAt)),
            formatMoney(Number(row.amount)),
            String(row.paymentMethod),
            String(row.status),
            String(row.note ?? "—"),
          ])}
        />
      ) : null}

      {tab === "profile" ? (
        <form
          onSubmit={saveProfile}
          className={`${cardBase} space-y-4 border-slate-200/70 bg-white`}
        >
          <div>
            <h3 className="text-[16px] font-extrabold text-[#0f1f4d]">
              Ödeme Bilgileri
            </h3>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">
              Komisyon ödemelerinin aktarılacağı banka hesabı ve iletişim
              bilgilerinizi girin.
            </p>
          </div>

          {profilePaymentFields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
                {field.label}
              </span>
              <input
                className={profileInputClass}
                value={profileForm[field.key]}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, [field.key]: e.target.value })
                }
                placeholder={field.placeholder}
                autoComplete={field.key === "iban" ? "off" : undefined}
              />
            </label>
          ))}

          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-2xl bg-[#0f1f4d] px-5 py-3 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {savingProfile ? "Kaydediliyor..." : "Bilgileri Kaydet"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  className,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  className: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`${cardBase} ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold opacity-80">{title}</p>
        {icon}
      </div>
      <p className="mt-2 text-[24px] font-extrabold">{value}</p>
      <p className="mt-1 text-[12px] font-semibold opacity-80">{subtitle}</p>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className={`${cardBase} overflow-x-auto border-slate-200/70 bg-white`}>
      <table className="min-w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-6 text-center text-slate-400">
                Kayıt bulunamadı.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-b border-slate-50 last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
