import Link from "next/link";
import { AdminCompanyHeaderActions } from "@/components/admin/companies/admin-company-header-actions";
import { AdminCompanyNotesPanel } from "@/components/admin/companies/admin-company-notes-panel";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import {
  appOutlineButtonClass,
  appPanelClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import {
  formatAdminDate,
  formatAdminDateTime,
  formatAdminMoney,
  getCompanyStatusClass,
  getCompanyStatusLabel,
  getMembershipStatusLabel,
} from "@/lib/admin-utils";
import type { AdminCompanyTab } from "@/lib/admin/companies/admin-company-detail-service";
import type { getAdminCompanyHeader } from "@/lib/admin/companies/admin-company-detail-service";

const TABS: Array<{ key: AdminCompanyTab; label: string }> = [
  { key: "overview", label: "Özet" },
  { key: "users", label: "Kullanıcılar" },
  { key: "subscription", label: "Abonelik" },
  { key: "payments", label: "Ödemeler" },
  { key: "usage", label: "Kullanım" },
  { key: "integrations", label: "Entegrasyonlar" },
  { key: "activity", label: "Aktivite" },
  { key: "notes", label: "Notlar" },
];

type Props = {
  header: NonNullable<Awaited<ReturnType<typeof getAdminCompanyHeader>>>;
  tab: AdminCompanyTab;
  tabData: unknown;
};

function tabHref(companyId: string, tab: AdminCompanyTab) {
  return `/admin/companies/${companyId}?tab=${tab}`;
}

export function AdminCompanyDetailShell({ header, tab, tabData }: Props) {
  return (
    <AdminPageContainer size="full">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/admin/companies" className="text-[12px] font-semibold text-slate-500 hover:underline">
            ← Firmalar
          </Link>
          <h1 className="mt-1 text-[20px] font-extrabold text-[#0f1f4d]">{header.name}</h1>
          <p className="text-[12px] text-slate-500">
            {header.shortId} · {getCompanyStatusLabel(header.status)} · Plan: {header.planName ?? "—"} · Abonelik: {header.subscriptionStatus ? getMembershipStatusLabel(header.subscriptionStatus) : "—"}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            Oluşturulma: {formatAdminDate(header.createdAt)} · Son aktivite: {header.lastActivityAt ? formatAdminDateTime(header.lastActivityAt) : "—"} · Not: {header.noteCount} · Açık sorun: {header.openIssueCount}
          </p>
          {header.owner ? (
            <p className="mt-1 text-[12px] text-slate-600">
              Sahip: {header.owner.name} ({header.owner.email})
            </p>
          ) : (
            <p className="mt-1 text-[12px] font-semibold text-rose-600">Sahip kullanıcı tanımlı değil</p>
          )}
        </div>
        <AdminCompanyHeaderActions
          companyId={header.id}
          companyName={header.name}
          status={header.status}
          subscriptionStatus={header.subscriptionStatus}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={tabHref(header.id, item.key)}
            className={[
              "rounded-xl px-3 py-1.5 text-[12px] font-bold",
              tab === item.key
                ? "bg-[#0f1f4d] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className={`${appPanelClass} p-4`}>
        {tab === "overview" ? <OverviewTab data={tabData} companyId={header.id} /> : null}
        {tab === "users" ? <UsersTab data={tabData} companyId={header.id} /> : null}
        {tab === "subscription" ? <SubscriptionTab data={tabData} companyId={header.id} subscriptionId={header.subscriptionId} /> : null}
        {tab === "payments" ? <PaymentsTab data={tabData} companyId={header.id} /> : null}
        {tab === "usage" ? <UsageTab data={tabData} /> : null}
        {tab === "integrations" ? <IntegrationsTab data={tabData} /> : null}
        {tab === "activity" ? <ActivityTab data={tabData} companyId={header.id} /> : null}
        {tab === "notes" ? <AdminCompanyNotesPanel companyId={header.id} notes={tabData as never} /> : null}
      </div>

      <div className={`${appPanelClass} mt-4 border-rose-100 p-4`}>
        <h3 className="text-sm font-bold text-rose-700">Tehlikeli İşlemler</h3>
        <p className="mt-1 text-[12px] text-slate-500">
          Firma arşivleme soft-delete yaklaşımıyla çalışır. Aktif abonelik veya bekleyen ödeme varsa engellenir.
        </p>
        <p className="mt-2 text-[12px] text-slate-400">
          Hard delete bu fazda desteklenmiyor. Arşivleme API üzerinden onaylı akışla yapılmalıdır.
        </p>
      </div>
    </AdminPageContainer>
  );
}

function OverviewTab({ data, companyId }: { data: unknown; companyId: string }) {
  if (!data) return <p className="text-sm text-slate-500">Özet verisi yüklenemedi.</p>;
  const overview = data as {
    companyInfo: Record<string, string | null>;
    platformInfo: Record<string, unknown>;
    usage: Record<string, number>;
    last30Days: Record<string, number | string>;
    issues: Array<{ label: string; href?: string }>;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section>
        <h3 className="mb-2 text-sm font-bold">Firma bilgileri</h3>
        <dl className="space-y-1 text-sm">
          {Object.entries(overview.companyInfo).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3 border-b border-slate-100 py-1">
              <dt className="text-slate-500">{key}</dt>
              <dd className="font-medium">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-bold">Son 30 gün</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Satış</dt><dd>{overview.last30Days.salesCount} adet</dd></div>
          <div className="flex justify-between"><dt>Satış tutarı</dt><dd>{formatAdminMoney(Number(overview.last30Days.salesAmount))}</dd></div>
          <div className="flex justify-between"><dt>Tahsilat</dt><dd>{formatAdminMoney(Number(overview.last30Days.collectionsAmount))}</dd></div>
          <div className="flex justify-between"><dt>Gider</dt><dd>{formatAdminMoney(Number(overview.last30Days.expensesAmount))}</dd></div>
          <div className="flex justify-between"><dt>Fatura</dt><dd>{overview.last30Days.invoicesCount}</dd></div>
          <div className="flex justify-between"><dt>E-belge</dt><dd>{overview.last30Days.eDocumentsCount}</dd></div>
        </dl>
      </section>
      <section className="lg:col-span-2">
        <h3 className="mb-2 text-sm font-bold">Açık sorunlar</h3>
        {overview.issues.length === 0 ? (
          <p className="text-sm text-slate-500">Açık sorun yok.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {overview.issues.map((issue) => (
              <Link key={issue.label} href={issue.href ?? tabHref(companyId, "overview")} className="rounded-full bg-amber-100 px-3 py-1 text-[12px] font-bold text-amber-800">
                {issue.label}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UsersTab({ data, companyId }: { data: unknown; companyId: string }) {
  const users = (data as Array<Record<string, unknown>>) ?? [];
  if (!users.length) return <p className="text-sm text-slate-500">Kullanıcı bulunamadı.</p>;
  return (
    <table className={appTableClass}>
      <thead><tr className={appTableHeadClass}>
        <th className="px-3 py-2">Kullanıcı</th><th className="px-3 py-2">Rol</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2">Son giriş</th><th className="px-3 py-2">İşlem</th>
      </tr></thead>
      <tbody>
        {users.map((user) => (
          <tr key={String(user.id)} className={appTableRowClass}>
            <td className="px-3 py-2"><p className="font-semibold">{String(user.name)}</p><p className="text-slate-500">{String(user.email)}</p></td>
            <td className="px-3 py-2 text-sm">{String(user.role)}{user.isOwner ? " · Sahip" : ""}</td>
            <td className="px-3 py-2 text-sm">{String(user.status)}</td>
            <td className="px-3 py-2 text-sm">{user.lastLoginAt ? formatAdminDateTime(String(user.lastLoginAt)) : "—"}</td>
            <td className="px-3 py-2"><Link href={String(user.href)} className="text-[12px] font-bold text-[#0f1f4d]">Detay</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SubscriptionTab({ data, companyId, subscriptionId }: { data: unknown; companyId: string; subscriptionId: string | null }) {
  const payload = data as {
    subscription: {
      subscription: Record<string, unknown>;
      mrrMinor?: number;
    } | null;
  };
  if (!payload?.subscription?.subscription) {
    return <p className="text-sm text-slate-500">Abonelik kaydı yok.</p>;
  }
  const sub = payload.subscription.subscription;
  return (
    <div className="space-y-3 text-sm">
      <p>Abonelik ID: {String(sub.id)}</p>
      <p>Durum: {getMembershipStatusLabel(String(sub.status))}</p>
      <p>Dönem sonu: {sub.currentPeriodEnd ? formatAdminDateTime(String(sub.currentPeriodEnd)) : "—"}</p>
      <p>MRR: {payload.subscription.mrrMinor ? formatAdminMoney(payload.subscription.mrrMinor / 100) : "—"}</p>
      <div className="flex flex-wrap gap-2">
        {subscriptionId ? <Link href={`/admin/subscriptions/${subscriptionId}`} className={appOutlineButtonClass}>Abonelik detayı</Link> : null}
        <Link href={`/admin/companies/${companyId}?tab=payments`} className={appOutlineButtonClass}>Ödemeler</Link>
      </div>
    </div>
  );
}

function PaymentsTab({ data, companyId }: { data: unknown; companyId: string }) {
  const payload = data as { items: Array<Record<string, unknown>> };
  const items = payload?.items ?? [];
  if (!items.length) return <p className="text-sm text-slate-500">Ödeme kaydı yok.</p>;
  return (
    <table className={appTableClass}>
      <thead><tr className={appTableHeadClass}>
        <th className="px-3 py-2">Tarih</th><th className="px-3 py-2">Tutar</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2">Hata</th>
      </tr></thead>
      <tbody>
        {items.map((item) => (
          <tr key={String(item.id)} className={appTableRowClass}>
            <td className="px-3 py-2">{formatAdminDateTime(String(item.date))}</td>
            <td className="px-3 py-2">{formatAdminMoney(Number(item.amount))}</td>
            <td className="px-3 py-2">{String(item.status)}</td>
            <td className="px-3 py-2 text-rose-600">{String(item.errorSummary ?? "—")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UsageTab({ data }: { data: unknown }) {
  const payload = data as { counts: Record<string, number>; monthly: Record<string, number> };
  if (!payload) return <p className="text-sm text-slate-500">Kullanım verisi alınamadı.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(payload.counts).map(([key, value]) => (
        <div key={key} className="rounded-xl border border-slate-200 p-3 text-sm">
          <p className="text-slate-500">{key}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      ))}
      <div className="sm:col-span-2 lg:col-span-3">
        <h4 className="mb-2 text-sm font-bold">Bu ay</h4>
        <p className="text-sm text-slate-600">
          {payload.monthly.eDocuments} e-belge · {payload.monthly.ocr} OCR · {payload.monthly.exports} export · {payload.monthly.api} API
        </p>
      </div>
    </div>
  );
}

function IntegrationsTab({ data }: { data: unknown }) {
  const payload = data as { items: Array<Record<string, unknown>> };
  const items = payload?.items ?? [];
  if (!items.length) return <p className="text-sm text-slate-500">Entegrasyon kaydı yok.</p>;
  return (
    <table className={appTableClass}>
      <thead><tr className={appTableHeadClass}>
        <th className="px-3 py-2">Sağlayıcı</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2">Credential</th><th className="px-3 py-2">Son hata</th>
      </tr></thead>
      <tbody>
        {items.map((item) => (
          <tr key={String(item.id)} className={appTableRowClass}>
            <td className="px-3 py-2 font-semibold">{String(item.provider)}</td>
            <td className="px-3 py-2">{String(item.status)}</td>
            <td className="px-3 py-2">{item.hasCredentials ? "Mevcut" : "Yok"}</td>
            <td className="px-3 py-2 text-rose-600">{String(item.lastError ?? "—")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActivityTab({ data, companyId }: { data: unknown; companyId: string }) {
  const payload = data as { items: Array<Record<string, unknown>> };
  const items = payload?.items ?? [];
  if (!items.length) return <p className="text-sm text-slate-500">Aktivite kaydı yok.</p>;
  return (
    <table className={appTableClass}>
      <thead><tr className={appTableHeadClass}>
        <th className="px-3 py-2">Tarih</th><th className="px-3 py-2">Aktör</th><th className="px-3 py-2">Modül</th><th className="px-3 py-2">Açıklama</th>
      </tr></thead>
      <tbody>
        {items.map((item) => (
          <tr key={String(item.id)} className={appTableRowClass}>
            <td className="px-3 py-2">{formatAdminDateTime(String(item.createdAt))}</td>
            <td className="px-3 py-2">{String(item.actorName)}</td>
            <td className="px-3 py-2">{String(item.module)} / {String(item.action)}</td>
            <td className="px-3 py-2 max-w-[360px] truncate">{String(item.description)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
