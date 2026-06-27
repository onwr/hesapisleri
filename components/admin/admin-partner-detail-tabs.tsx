"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { AdminPartnerActions } from "@/components/admin/admin-partner-actions";
import { AdminPartnerEditModal } from "@/components/admin/admin-partner-edit-modal";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminDateTime, formatAdminMoney } from "@/lib/admin-utils";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import type {
  getPartnerDetail,
  listPartnerActivity,
  listPartnerCommissions,
  listPartnerCompanies,
  listPartnerHistory,
} from "@/lib/admin/partners";
import type { listAdminPartnerNotes } from "@/lib/admin/partners/admin-partner-note-service";

type DetailData = NonNullable<Awaited<ReturnType<typeof getPartnerDetail>>>;

const TABS = [
  { id: "overview", label: "Genel" },
  { id: "companies", label: "Firmalar" },
  { id: "commissions", label: "Komisyonlar" },
  { id: "history", label: "Geçmiş" },
  { id: "activity", label: "Aktivite" },
  { id: "notes", label: "Notlar" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminPartnerDetailTabs({
  detail,
  companies,
  companiesPagination,
  commissions,
  history,
  historyPagination,
  activity,
  activityPagination,
  notes,
}: {
  detail: DetailData;
  companies: Awaited<ReturnType<typeof listPartnerCompanies>>["items"];
  companiesPagination: Awaited<ReturnType<typeof listPartnerCompanies>>["pagination"];
  commissions: Awaited<ReturnType<typeof listPartnerCommissions>> | null;
  history: Awaited<ReturnType<typeof listPartnerHistory>>["items"];
  historyPagination: Awaited<ReturnType<typeof listPartnerHistory>>["pagination"];
  activity: Awaited<ReturnType<typeof listPartnerActivity>>["items"];
  activityPagination: Awaited<ReturnType<typeof listPartnerActivity>>["pagination"];
  notes: Awaited<ReturnType<typeof listAdminPartnerNotes>>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab");
  const tab: TabId = (TABS.some((t) => t.id === rawTab) ? rawTab : "overview") as TabId;
  const [noteContent, setNoteContent] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [flash, setFlash] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const { partner, stats, issues } = detail;

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim() || noteLoading) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/admin/partners/${partner.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setNoteContent("");
      setFlash("Not eklendi.");
      router.refresh();
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Not eklenemedi.");
    } finally {
      setNoteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0f1f4d]">{partner.fullName}</h1>
          <p className="mt-1 font-mono text-[13px] text-slate-500">{partner.referralCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {partner.status !== "ARCHIVED" ? (
            <button type="button" className={appOutlineButtonClass} onClick={() => setEditOpen(true)}>
              Düzenle
            </button>
          ) : null}
          <Link href="/admin/partners" className={appOutlineButtonClass}>
            Listeye Dön
          </Link>
        </div>
      </div>

      {flash ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-[13px] text-emerald-800">
          {flash}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Durum" value={partner.status} />
        <Stat label="Komisyon" value={`%${partner.commissionRate}`} />
        <Stat label="Bağlı firma" value={String(stats.companyCount)} />
        <Stat label="Aktif abonelikli" value={String(stats.activeSubscriptionCompanies)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/admin/partners/${partner.id}?tab=${item.id}`}
            className={`rounded-2xl px-4 py-2 text-[13px] font-bold transition ${
              tab === item.id
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className={`${appPanelClass} grid gap-4 p-5 md:grid-cols-2`}>
          <Info title="İletişim" rows={[
            ["E-posta", partner.email],
            ["Telefon", partner.phone ?? "—"],
            ["Referans URL", partner.referralUrl],
          ]} />
          <Info title="Ödeme" rows={[
            ["IBAN", partner.iban ?? "—"],
            ["Banka", partner.bankName ?? "—"],
            ["Vergi No", partner.taxNumber ?? "—"],
            ["Yöntem", partner.payoutMethod ?? "—"],
          ]} />
          {issues.length ? (
            <div className="md:col-span-2">
              <h3 className="mb-2 text-[14px] font-extrabold text-[#0f1f4d]">Sorunlar</h3>
              <ul className="space-y-1 text-[12px]">
                {issues.map((issue) => (
                  <li key={issue.code} className="text-amber-800">
                    <span className="font-bold">{issue.code}</span>: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <AdminPartnerActions partnerId={partner.id} status={partner.status} onDone={() => router.refresh()} />
          </div>
        </div>
      )}

      {tab === "companies" && (
        <div className={`${appPanelClass} overflow-x-auto p-4`}>
          {companies.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-slate-500">Bağlı firma yok.</p>
          ) : (
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Kaynak</th>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Abonelik</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">MRR</th>
                  <th className="px-3 py-2">Son ödeme</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.companyId} className={appTableRowClass}>
                    <td className="px-3 py-3">
                      <Link href={`/admin/companies/${c.companyId}`} className="font-bold text-blue-700 hover:underline">
                        {c.companyName}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{c.relationSource}</td>
                    <td className="px-3 py-3">{formatAdminDate(c.referredAt)}</td>
                    <td className="px-3 py-3">{c.subscriptionStatus ?? "—"}</td>
                    <td className="px-3 py-3">{c.plan?.name ?? "—"}</td>
                    <td className="px-3 py-3">
                      {c.mrrMonthlyMinor != null && c.mrrCurrency
                        ? formatMinorToMoney(c.mrrMonthlyMinor, c.mrrCurrency)
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      {c.lastPayment?.amountMinor != null && c.lastPayment.currency
                        ? formatMinorToMoney(c.lastPayment.amountMinor, c.lastPayment.currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {companiesPagination.totalPages > 1 ? (
            <p className="mt-3 text-[12px] text-slate-500">
              Sayfa {companiesPagination.page} / {companiesPagination.totalPages}
            </p>
          ) : null}
        </div>
      )}

      {tab === "commissions" && commissions && (
        <div className="space-y-4">
          <div className={`${appPanelClass} p-4 text-[13px]`}>
            <h3 className="font-extrabold text-[#0f1f4d]">Para birimi bazlı toplamlar</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(commissions.totalsByCurrency).map(([cur, t]) => (
                <div key={cur} className="rounded border border-slate-100 p-3">
                  <p className="font-bold">{cur}</p>
                  <p>Bekleyen: {formatAdminMoney(t.pending)}</p>
                  <p>Onaylı: {formatAdminMoney(t.approved)}</p>
                  <p>Ödenebilir: {formatAdminMoney(t.payable)}</p>
                  <p>Ödenen: {formatAdminMoney(t.paid)}</p>
                </div>
              ))}
            </dl>
          </div>
          <div className={`${appPanelClass} overflow-x-auto p-4`}>
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Tip</th>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Komisyon</th>
                  <th className="px-3 py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {commissions.conversions.map((c) => (
                  <tr key={c.id} className={appTableRowClass}>
                    <td className="px-3 py-3">{formatAdminDateTime(c.occurredAt)}</td>
                    <td className="px-3 py-3">{c.typeLabel}</td>
                    <td className="px-3 py-3">{c.company?.name ?? "—"}</td>
                    <td className="px-3 py-3">{formatAdminMoney(c.commissionAmount)}</td>
                    <td className="px-3 py-3">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className={`${appPanelClass} p-5`}>
          {history.length === 0 ? (
            <p className="text-[13px] text-slate-500">Geçmiş kaydı yok.</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 px-4 py-3 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <p className="font-bold">{item.action}</p>
                    <p className="text-[11px] text-slate-400">{formatAdminDateTime(item.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-slate-600">{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className={`${appPanelClass} p-5`}>
          {activity.length === 0 ? (
            <p className="text-[13px] text-slate-500">Aktivite kaydı yok.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 px-4 py-3 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <p className="font-bold">{item.action}</p>
                    <p className="text-[11px] text-slate-400">{formatAdminDateTime(item.createdAt)}</p>
                  </div>
                  {item.message ? <p className="mt-1 text-slate-600">{item.message}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className={`${appPanelClass} space-y-4 p-5`}>
          <form onSubmit={addNote} className="space-y-2">
            <textarea
              className="w-full rounded border px-3 py-2 text-[13px]"
              rows={3}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Yeni not…"
            />
            <button type="submit" className={appPrimaryButtonClass} disabled={noteLoading}>
              {noteLoading ? "Kaydediliyor…" : "Not Ekle"}
            </button>
          </form>
          {notes.length === 0 ? (
            <p className="text-[13px] text-slate-500">Not yok.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-xl border border-slate-100 px-4 py-3 text-[13px]">
                  <p>{note.content}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {formatAdminDateTime(note.createdAt)}
                    {note.isPinned ? " · Sabitlendi" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <AdminPartnerEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        partner={partner}
        onSuccess={(msg) => {
          setEditOpen(false);
          setFlash(msg);
          router.refresh();
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${appPanelClass} p-4`}>
      <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#0f1f4d]">{value}</p>
    </div>
  );
}

function Info({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="mb-2 text-[14px] font-extrabold text-[#0f1f4d]">{title}</h3>
      <dl className="space-y-2 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="max-w-[60%] text-right font-semibold text-[#0f1f4d]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
