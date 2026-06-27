"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAdminDate } from "@/lib/admin-utils";
import { formatMinor } from "@/lib/admin/subscriptions/admin-subscription-serializers";
import { appInputClass, appPrimaryButtonClass, appSelectClass } from "@/lib/admin-ui";
import type { getAdminPaymentHeader } from "@/lib/admin/payments/admin-payment-detail-service";
import type { AdminPaymentTab } from "@/lib/admin/payments/admin-payment-schemas";

type Header = NonNullable<Awaited<ReturnType<typeof getAdminPaymentHeader>>>;

type Props = {
  tab: AdminPaymentTab;
  data: unknown;
  paymentId: string;
  header: Header;
  onReload: () => Promise<void>;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

export function AdminPaymentTabContent({ tab, data, paymentId, header, onReload }: Props) {
  if (!data) return <p className="text-slate-500">Veri yok.</p>;

  switch (tab) {
    case "overview":
      return <OverviewPanel data={data} />;
    case "provider":
      return <ProviderPanel data={data} />;
    case "subscription":
      return <SubscriptionPanel data={data} />;
    case "refunds":
      return <RefundsPanel data={data} paymentId={paymentId} />;
    case "events":
      return <EventsPanel data={data} />;
    case "activity":
      return <ActivityPanel data={data} />;
    case "notes":
      return <NotesPanel data={data} paymentId={paymentId} onReload={onReload} />;
    default:
      return <OverviewPanel data={data} />;
  }
}

function OverviewPanel({ data }: { data: unknown }) {
  const d = data as {
    payment: Record<string, unknown>;
    pricing: { snapshotTotalMinor: number | null; amountMatchesSnapshot: boolean | null };
    refunds: { fromRefunds: number; fromPaymentField: number; mismatch: boolean };
    subscription: { href: string; status: string } | null;
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Ödeme">
        <Row label="Durum" value={String(d.payment.status)} />
        <Row label="Tutar" value={formatMinor(d.payment.amountMinor as number, d.payment.currency as string)} />
        <Row label="Provider" value={String(d.payment.provider)} />
        <Row label="Merchant OID" value={String(d.payment.merchantOidMasked)} />
        <Row label="Callback" value={d.payment.callbackReceivedAt ? formatAdminDate(String(d.payment.callbackReceivedAt)) : "—"} />
        <Row label="Hata" value={String(d.payment.errorSummary || "—")} />
      </Section>
      <Section title="Fiyat / İade">
        <Row
          label="Snapshot total"
          value={
            d.pricing.snapshotTotalMinor != null
              ? formatMinor(d.pricing.snapshotTotalMinor, d.payment.currency as string)
              : "Karşılaştırılamıyor"
          }
        />
        <Row
          label="Snapshot uyumu"
          value={
            d.pricing.amountMatchesSnapshot == null
              ? "—"
              : d.pricing.amountMatchesSnapshot
                ? "Uyumlu"
                : "Uyumsuz"
          }
        />
        <Row label="Tamamlanan iade (refund rows)" value={formatMinor(d.refunds.fromRefunds, d.payment.currency as string)} />
        <Row label="Payment.refundedAmountMinor" value={formatMinor(d.refunds.fromPaymentField, d.payment.currency as string)} />
        {d.refunds.mismatch && (
          <p className="mt-2 text-xs text-amber-700">İade snapshot uyuşmazlığı tespit edildi.</p>
        )}
      </Section>
      {d.subscription && (
        <Section title="Abonelik">
          <Row label="Durum" value={d.subscription.status} />
          <Link href={d.subscription.href} className="text-sm text-blue-600 hover:underline">
            Abonelik detayı
          </Link>
        </Section>
      )}
    </div>
  );
}

function ProviderPanel({ data }: { data: unknown }) {
  const d = data as {
    webhooks: Array<Record<string, unknown>>;
    reconciliations: Array<Record<string, unknown>>;
    duplicateCallbackNote: string;
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{d.duplicateCallbackNote}</p>
      <Section title="Webhook olayları (güvenli alanlar)">
        {d.webhooks.length === 0 ? (
          <p className="text-sm text-slate-500">Kayıt yok.</p>
        ) : (
          <div className="space-y-2">
            {d.webhooks.map((w) => (
              <div key={String(w.id)} className="rounded border border-slate-100 p-2 text-xs">
                <div className="font-semibold">{String(w.processingStatus)}</div>
                <div>eventKey: {String(w.eventKeyMasked)}</div>
                <div>attempt: {String(w.attemptCount)} · IP: {String(w.sourceIpMasked)}</div>
                <div>{formatAdminDate(String(w.receivedAt))}</div>
                {w.lastError ? <div className="text-rose-600">{String(w.lastError)}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Reconciliation">
        {d.reconciliations.length === 0 ? (
          <p className="text-sm text-slate-500">Kayıt yok.</p>
        ) : (
          d.reconciliations.map((r) => (
            <Row
              key={String(r.id)}
              label={formatAdminDate(String(r.checkedAt))}
              value={`${r.localStatus} / ${r.providerStatus}`}
            />
          ))
        )}
      </Section>
    </div>
  );
}

function SubscriptionPanel({ data }: { data: unknown }) {
  const d = data as {
    linked: boolean;
    subscription: { href: string; status: string; plan: { name: string }; companyMatch: boolean } | null;
    billingRun: { status: string; periodStart: string; periodEnd: string } | null;
  };
  if (!d.linked) return <p className="text-slate-500">Bu ödeme bir aboneliğe bağlı değil.</p>;
  if (!d.subscription) return <p className="text-rose-600">Bağlı abonelik bulunamadı.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Abonelik">
        <Row label="Plan" value={d.subscription.plan.name} />
        <Row label="Durum" value={d.subscription.status} />
        <Row label="Firma eşleşmesi" value={d.subscription.companyMatch ? "Uyumlu" : "Uyumsuz"} />
        <Link href={d.subscription.href} className="text-sm text-blue-600 hover:underline">
          Abonelik detayı
        </Link>
      </Section>
      {d.billingRun && (
        <Section title="Billing run">
          <Row label="Durum" value={d.billingRun.status} />
          <Row label="Dönem" value={`${formatAdminDate(d.billingRun.periodStart)} – ${formatAdminDate(d.billingRun.periodEnd)}`} />
        </Section>
      )}
    </div>
  );
}

function RefundsPanel({ data, paymentId }: { data: unknown; paymentId: string }) {
  const d = data as {
    refunds: Array<Record<string, unknown>>;
    gate: {
      canInitiate: boolean;
      reasons: string[];
      missingGates: string[];
      maxRefundableMinor: number;
      currency: string;
    };
    readOnly: boolean;
    reconcile: { fromRefunds: number; mismatch: boolean };
  };

  const [amountMinor, setAmountMinor] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitRefund() {
    const amount = Number.parseInt(amountMinor, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage("Geçerli bir tutar girin.");
      return;
    }
    if (reason.trim().length < 3) {
      setMessage("İade nedeni zorunludur.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMinor: amount, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setMessage(json.message ?? "İade başarısız");
        return;
      }
      setMessage(`İade ${json.data.status}: ${json.data.referenceNo}`);
      setAmountMinor("");
      setReason("");
      window.location.reload();
    } catch {
      setMessage("İade isteği gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {d.readOnly && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          İade oluşturma kapalı (read-only).
          {d.gate.missingGates.length > 0 && (
            <span> Eksik: {d.gate.missingGates.join(", ")}</span>
          )}
          {d.gate.reasons.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {d.gate.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {d.gate.canInitiate && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-2 text-sm font-bold text-slate-700">İade oluştur</h4>
          <p className="mb-2 text-xs text-slate-500">
            Maks. iade: {formatMinor(d.gate.maxRefundableMinor, d.gate.currency)}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={appInputClass}
              type="number"
              placeholder="Tutar (kuruş)"
              value={amountMinor}
              onChange={(e) => setAmountMinor(e.target.value)}
            />
            <input
              className={`${appInputClass} flex-1`}
              placeholder="İade nedeni"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitRefund()}
              className={appPrimaryButtonClass}
            >
              {submitting ? "…" : "İade başlat"}
            </button>
          </div>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        </div>
      )}
      <Section title="İade kayıtları">
        {d.refunds.length === 0 ? (
          <p className="text-sm text-slate-500">İade yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="py-2">Ref</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {d.refunds.map((r) => (
                <tr key={String(r.id)} className="border-b border-slate-50">
                  <td className="py-2 font-mono text-xs">{String(r.referenceNo)}</td>
                  <td>{formatMinor(r.amountMinor as number, r.currency as string)}</td>
                  <td>{String(r.status)}</td>
                  <td className="text-xs text-slate-500">
                    {r.completedAt ? formatAdminDate(String(r.completedAt)) : formatAdminDate(String(r.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function EventsPanel({ data }: { data: unknown }) {
  const d = data as { events: Array<{ id: string; source: string; title: string; detail?: string; occurredAt: string }> };
  return (
    <div className="space-y-2">
      {d.events.map((e) => (
        <div key={e.id} className="flex gap-3 border-b border-slate-100 py-2 text-sm">
          <span className="w-24 shrink-0 text-[10px] font-bold uppercase text-slate-400">{e.source}</span>
          <div className="flex-1">
            <div className="font-semibold text-slate-800">{e.title}</div>
            {e.detail && <div className="text-xs text-slate-500">{e.detail}</div>}
          </div>
          <span className="text-xs text-slate-400">{formatAdminDate(e.occurredAt)}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityPanel({ data }: { data: unknown }) {
  const d = data as {
    items: Array<{ id: string; action: string; message: string | null; createdAt: string; user: { name: string } | null }>;
  };
  return (
    <div className="space-y-2">
      {d.items.map((i) => (
        <div key={i.id} className="border-b border-slate-100 py-2 text-sm">
          <div className="font-semibold">{i.action}</div>
          {i.message && <div className="text-xs text-slate-600">{i.message}</div>}
          <div className="text-xs text-slate-400">
            {i.user?.name ?? "Sistem"} · {formatAdminDate(i.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesPanel({
  data,
  paymentId,
  onReload,
}: {
  data: unknown;
  paymentId: string;
  onReload: () => Promise<void>;
}) {
  const notes = data as Array<{
    id: string;
    content: string;
    category: string;
    isPinned: boolean;
    author: { name: string } | null;
    createdAt: string;
  }>;
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [saving, setSaving] = useState(false);

  async function submitNote() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, category }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setContent("");
      await onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Hata");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className={appSelectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="GENERAL">Genel</option>
          <option value="PAYMENT">Ödeme</option>
          <option value="CALLBACK">Callback</option>
          <option value="REFUND">İade</option>
          <option value="BILLING">Fatura</option>
          <option value="RISK">Risk</option>
          <option value="SUPPORT">Destek</option>
          <option value="TECHNICAL">Teknik</option>
        </select>
        <input
          className={`${appInputClass} flex-1`}
          placeholder="Not ekle…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button type="button" disabled={saving} onClick={() => void submitNote()} className={appPrimaryButtonClass}>
          {saving ? "…" : "Ekle"}
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-slate-500">Not yok.</p>
      ) : (
        notes.map((n) => (
          <div key={n.id} className="rounded border border-slate-200 p-3 text-sm">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>
                {n.category}
                {n.isPinned && " · Sabit"}
              </span>
              <span>
                {n.author?.name ?? "Silinmiş kullanıcı"} · {formatAdminDate(n.createdAt)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-slate-800">{n.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
