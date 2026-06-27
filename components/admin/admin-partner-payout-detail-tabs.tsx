"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminDateTime, formatAdminMoney } from "@/lib/admin-utils";

type DetailData = {
  payout: {
    id: string;
    partnerId: string;
    status: string;
    currency: string;
    amount: number;
    earningCount: number;
    paymentMethod: string;
    note: string | null;
    paymentReferenceMasked: string | null;
    paidAt: string | null;
    paidBy: { id: string; name: string | null; email: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  partner: {
    id: string;
    fullName: string;
    email: string;
    referralCode: string;
    status: string;
    paymentProfile: {
      payoutMethod: string | null;
      ibanMasked: string | null;
      bankName: string | null;
      accountHolderName: string | null;
    };
  };
  issues: Array<{ code: string; severity: string; message: string }>;
};

const TABS = [
  { id: "overview", label: "Genel" },
  { id: "earnings", label: "Hak Edişler" },
  { id: "history", label: "Geçmiş" },
  { id: "activity", label: "Aktivite" },
  { id: "notes", label: "Notlar" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type EarningRow = {
  id: string;
  companyName: string | null;
  membershipPaymentId: string | null;
  conversionType: string | null;
  commissionRate: number | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
};

type HistoryRow = {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
};

type NoteRow = {
  id: string;
  content: string;
  category: string;
  priority: string;
  isPinned: boolean;
  author: { id: string; name: string | null; email: string } | null;
  createdAt: string;
};

function statusClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING") return "bg-amber-100 text-amber-700";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export function AdminPartnerPayoutDetailTabs({
  detail,
  earnings,
  history,
  activity,
  notes,
}: {
  detail: DetailData;
  earnings: EarningRow[];
  history: HistoryRow[];
  activity: HistoryRow[];
  notes: NoteRow[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab");
  const tab: TabId = (TABS.some((t) => t.id === rawTab) ? rawTab : "overview") as TabId;

  const { payout, partner, issues } = detail;
  const [modal, setModal] = useState<"approve" | "reject" | "paid" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [flash, setFlash] = useState("");

  const canApprove = payout.status === "DRAFT";
  const canReject = payout.status === "DRAFT" || payout.status === "PENDING";
  const canMarkPaid = payout.status === "PENDING";

  function tabHref(id: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    return `/admin/partners/payouts/${payout.id}?${params.toString()}`;
  }

  async function submitLifecycle(endpoint: string, body: Record<string, unknown>) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/partner-payouts/${payout.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "İşlem başarısız.");
      setModal(null);
      setReason("");
      setConfirm(false);
      setPaymentReference("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setLoading(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim() || noteLoading) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/admin/partner-payouts/${payout.id}/notes`, {
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
          <h1 className="text-[22px] font-extrabold text-[#0f1f4d]">Partner Ödemesi</h1>
          <p className="mt-1 font-mono text-[13px] text-slate-500">{payout.id}</p>
          <Link href={`/admin/partners/${partner.id}`} className="text-[13px] font-bold text-blue-700 hover:underline">
            {partner.fullName} · {partner.referralCode}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {canApprove ? (
            <button type="button" className={appPrimaryButtonClass} onClick={() => setModal("approve")}>
              Onayla
            </button>
          ) : null}
          {canReject ? (
            <button type="button" className={appOutlineButtonClass} onClick={() => setModal("reject")}>
              İptal
            </button>
          ) : null}
          {canMarkPaid ? (
            <button type="button" className={appPrimaryButtonClass} onClick={() => setModal("paid")}>
              Ödendi İşaretle
            </button>
          ) : null}
          <Link href="/admin/partners/payouts" className={appOutlineButtonClass}>
            Listeye Dön
          </Link>
        </div>
      </div>

      {flash ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-[13px] text-emerald-800">
          {flash}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-bold ${
              tab === t.id ? "bg-[#0f1f4d] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={appPanelClass + " p-4 space-y-3"}>
            <h2 className="font-bold text-slate-800">Özet</h2>
            <Row label="Durum">
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${statusClass(payout.status)}`}>
                {payout.status}
              </span>
            </Row>
            <Row label="Tutar">
              {formatAdminMoney(payout.amount)} {payout.currency}
            </Row>
            <Row label="Hak ediş sayısı">{payout.earningCount}</Row>
            <Row label="Ödeme yöntemi">{payout.paymentMethod}</Row>
            <Row label="Ödeme referansı">{payout.paymentReferenceMasked ?? "—"}</Row>
            <Row label="Ödeyen admin">
              {payout.paidBy?.name ?? payout.paidBy?.email ?? "—"}
            </Row>
            <Row label="Oluşturulma">{formatAdminDateTime(payout.createdAt)}</Row>
            <Row label="Ödeme tarihi">{payout.paidAt ? formatAdminDateTime(payout.paidAt) : "—"}</Row>
            {payout.note ? <Row label="Açıklama">{payout.note}</Row> : null}
          </div>
          <div className={appPanelClass + " p-4 space-y-3"}>
            <h2 className="font-bold text-slate-800">Ödeme profili</h2>
            <Row label="Yöntem">{partner.paymentProfile.payoutMethod ?? "—"}</Row>
            <Row label="IBAN">{partner.paymentProfile.ibanMasked ?? "—"}</Row>
            <Row label="Banka">{partner.paymentProfile.bankName ?? "—"}</Row>
            <Row label="Hesap sahibi">{partner.paymentProfile.accountHolderName ?? "—"}</Row>
          </div>
          {issues.length ? (
            <div className={`${appPanelClass} p-4 lg:col-span-2`}>
              <h2 className="mb-2 font-bold text-slate-800">Sorunlar</h2>
              <ul className="space-y-1 text-[13px]">
                {issues.map((issue) => (
                  <li key={issue.code} className="text-amber-800">
                    <span className="font-mono text-[11px]">{issue.code}</span> — {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "earnings" ? (
        <div className={appPanelClass}>
          <div className="overflow-x-auto">
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Tip / Oran</th>
                  <th className="px-3 py-2">Tutar</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id} className={appTableRowClass}>
                    <td className="px-3 py-3 font-mono text-[11px]">{e.id}</td>
                    <td className="px-3 py-3">{e.companyName ?? "—"}</td>
                    <td className="px-3 py-3">
                      {e.conversionType ?? "—"}
                      {e.commissionRate != null ? ` · %${e.commissionRate}` : ""}
                    </td>
                    <td className="px-3 py-3">
                      {formatAdminMoney(e.amount)} {e.currency}
                    </td>
                    <td className="px-3 py-3">{e.status}</td>
                    <td className="px-3 py-3">{formatAdminDate(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "history" || tab === "activity" ? (
        <div className={appPanelClass}>
          <div className="overflow-x-auto">
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Aksiyon</th>
                  <th className="px-3 py-2">Mesaj</th>
                  <th className="px-3 py-2">Kullanıcı</th>
                </tr>
              </thead>
              <tbody>
                {(tab === "history" ? history : activity).map((row) => (
                  <tr key={row.id} className={appTableRowClass}>
                    <td className="px-3 py-3">{formatAdminDateTime(row.createdAt)}</td>
                    <td className="px-3 py-3 font-mono text-[11px]">{row.action}</td>
                    <td className="px-3 py-3">{row.message ?? "—"}</td>
                    <td className="px-3 py-3">{row.user?.name ?? row.user?.email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="space-y-4">
          <form onSubmit={addNote} className={`${appPanelClass} flex flex-col gap-3 p-4`}>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Not yazın…"
              className="min-h-[80px] rounded border px-3 py-2 text-[13px]"
            />
            <button type="submit" disabled={noteLoading} className={appPrimaryButtonClass}>
              {noteLoading ? "Kaydediliyor…" : "Not Ekle"}
            </button>
          </form>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className={`${appPanelClass} p-4`}>
                <p className="text-[13px] text-slate-800">{note.content}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  {note.author?.name ?? "Sistem"} · {formatAdminDateTime(note.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${appPanelClass} w-full max-w-md space-y-4 p-5`}>
            <h3 className="text-lg font-bold text-slate-800">
              {modal === "approve" ? "Ödemeyi Onayla" : modal === "reject" ? "Ödemeyi İptal Et" : "Ödendi İşaretle"}
            </h3>
            {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}
            <label className="block text-[13px]">
              Gerekçe
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>
            {modal === "paid" ? (
              <label className="block text-[13px]">
                Ödeme referansı (zorunlu)
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              Bu işlemi onaylıyorum
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => setModal(null)} disabled={loading}>
                Vazgeç
              </button>
              <button
                type="button"
                className={appPrimaryButtonClass}
                disabled={
                  loading ||
                  !confirm ||
                  !reason.trim() ||
                  (modal === "paid" && !paymentReference.trim())
                }
                onClick={() => {
                  const body = { reason: reason.trim(), confirm: true as const };
                  if (modal === "approve") void submitLifecycle("approve", body);
                  else if (modal === "reject") void submitLifecycle("reject", body);
                  else void submitLifecycle("mark-paid", { ...body, paymentReference: paymentReference.trim() });
                }}
              >
                {loading ? "İşleniyor…" : "Onayla"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{children}</span>
    </div>
  );
}
