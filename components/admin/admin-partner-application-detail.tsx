"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PartnerBadgeType } from "@prisma/client";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin-utils";
import { generateReferralCode, getBadgeTypeLabel } from "@/lib/partner-utils";

type DetailData = {
  application: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    socialUrl: string | null;
    audienceTypeLabel: string;
    expectedReach: string | null;
    message: string | null;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    waitingDays: number | null;
    adminEvaluationNote: string | null;
  };
  matchedUser: {
    id: string;
    name: string | null;
    email: string;
    status: string;
  } | null;
  linkedPartner: Record<string, unknown> | null;
  issues: Array<{ code: string; severity: string; message: string }>;
  history: Array<{ id: string; action: string; message: string | null; createdAt: string }>;
};

const badgeOptions: PartnerBadgeType[] = [
  "NONE",
  "PARTNER",
  "VERIFIED",
  "INFLUENCER",
  "CELEBRITY",
  "VIP",
];

export function AdminPartnerApplicationDetail({
  detail,
}: {
  detail: DetailData;
}) {
  const router = useRouter();
  const { application, matchedUser, linkedPartner, issues, history } = detail;
  const [modal, setModal] = useState<"approve" | "reject" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [approveForm, setApproveForm] = useState({
    referralCode: generateReferralCode(application.fullName),
    commissionRate: 10,
    badgeType: "PARTNER" as PartnerBadgeType,
    badgeLabel: "Onaylı Partner",
    notes: "",
  });

  const isPending = application.status === "PENDING";

  async function submitApprove() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/partner-applications/${application.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          confirm: true,
          ...approveForm,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Onay başarısız.");
      setModal(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onay başarısız.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReject() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/partner-applications/${application.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), confirm: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Red başarısız.");
      setModal(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Red başarısız.");
    } finally {
      setLoading(false);
    }
  }

  function openModal(kind: "approve" | "reject") {
    setModal(kind);
    setReason("");
    setConfirm(false);
    setError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0f1f4d]">{application.fullName}</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {application.status} · {formatAdminDate(application.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPending ? (
            <>
              <button type="button" className={appPrimaryButtonClass} onClick={() => openModal("approve")}>
                Onayla
              </button>
              <button type="button" className={appOutlineButtonClass} onClick={() => openModal("reject")}>
                Reddet
              </button>
            </>
          ) : null}
          <Link href="/admin/partners/applications" className={appOutlineButtonClass}>
            Listeye dön
          </Link>
        </div>
      </div>

      {issues.length ? (
        <div className={`${appPanelClass} p-4`}>
          <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">Açık sorunlar</h2>
          <ul className="mt-2 space-y-1 text-[12px]">
            {issues.map((issue) => (
              <li key={issue.code} className="text-amber-800">
                <span className="font-bold">{issue.code}</span>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Başvuran">
          <Row label="Ad soyad" value={application.fullName} />
          <Row label="E-posta" value={application.email} />
          <Row label="Telefon" value={application.phone ?? "—"} />
          <Row label="Kitle" value={application.audienceTypeLabel} />
          <Row label="Sosyal" value={application.socialUrl ?? "—"} />
          <Row label="Erişim" value={application.expectedReach ?? "—"} />
        </Section>

        <Section title="Başvuru">
          <Row label="Durum" value={application.status} />
          <Row label="Bekleme" value={application.waitingDays != null ? `${application.waitingDays} gün` : "—"} />
          <Row label="İncelenme" value={application.reviewedAt ? formatAdminDateTime(application.reviewedAt) : "—"} />
          {application.adminEvaluationNote ? (
            <Row label="Admin notu" value={application.adminEvaluationNote} />
          ) : null}
        </Section>

        <Section title="Kullanıcı eşleşmesi">
          {matchedUser ? (
            <>
              <Row label="Kullanıcı ID" value={matchedUser.id} />
              <Row label="Ad" value={matchedUser.name ?? "—"} />
              <Row label="E-posta" value={matchedUser.email} />
              <Row label="Durum" value={matchedUser.status} />
            </>
          ) : (
            <p className="text-[12px] text-slate-500">Eşleşen kullanıcı yok.</p>
          )}
        </Section>

        <Section title="Partner eşleşmesi">
          {linkedPartner ? (
            <>
              {"id" in linkedPartner && typeof linkedPartner.id === "string" ? (
                <p className="mb-2">
                  <Link href={`/admin/partners/${linkedPartner.id}`} className="text-[12px] font-bold text-blue-700 hover:underline">
                    Partner detayı →
                  </Link>
                </p>
              ) : null}
              {"referralCode" in linkedPartner && typeof linkedPartner.referralCode === "string" ? (
                <Row label="Referans kodu" value={linkedPartner.referralCode} />
              ) : null}
              {"status" in linkedPartner && typeof linkedPartner.status === "string" ? (
                <Row label="Durum" value={linkedPartner.status} />
              ) : null}
              {"ibanMasked" in linkedPartner ? (
                <Row label="IBAN" value={String(linkedPartner.ibanMasked ?? "—")} />
              ) : null}
              {"taxNumberMasked" in linkedPartner ? (
                <Row label="Vergi no" value={String(linkedPartner.taxNumberMasked ?? "—")} />
              ) : null}
            </>
          ) : (
            <p className="text-[12px] text-slate-500">Bağlı partner profili yok.</p>
          )}
        </Section>
      </div>

      {application.message ? (
        <div className={`${appPanelClass} p-4`}>
          <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">Başvuru açıklaması</h2>
          <p className="mt-2 whitespace-pre-wrap text-[13px] text-slate-700">{application.message}</p>
        </div>
      ) : null}

      <div className={`${appPanelClass} overflow-x-auto p-4`}>
        <h2 className="mb-3 text-[14px] font-extrabold text-[#0f1f4d]">Geçmiş işlemler</h2>
        {history.length === 0 ? (
          <p className="text-[12px] text-slate-500">Kayıt yok.</p>
        ) : (
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Aksiyon</th>
                <th className="px-3 py-2">Özet</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className={appTableRowClass}>
                  <td className="px-3 py-3 text-[12px]">{formatAdminDateTime(row.createdAt)}</td>
                  <td className="px-3 py-3 font-mono text-[11px]">{row.action}</td>
                  <td className="px-3 py-3 text-[12px]">{row.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-[14px] font-bold text-slate-900">
              {modal === "approve" ? "Başvuruyu onayla" : "Başvuruyu reddet"}
            </h3>

            {modal === "approve" ? (
              <div className="mt-4 space-y-3 text-[12px]">
                <label className="block">
                  Referans kodu
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 font-mono"
                    value={approveForm.referralCode}
                    onChange={(e) =>
                      setApproveForm({ ...approveForm, referralCode: e.target.value.toUpperCase() })
                    }
                  />
                </label>
                <label className="block">
                  Komisyon (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={approveForm.commissionRate}
                    onChange={(e) =>
                      setApproveForm({ ...approveForm, commissionRate: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="block">
                  Rozet
                  <select
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={approveForm.badgeType}
                    onChange={(e) =>
                      setApproveForm({ ...approveForm, badgeType: e.target.value as PartnerBadgeType })
                    }
                  >
                    {badgeOptions.map((b) => (
                      <option key={b} value={b}>
                        {getBadgeTypeLabel(b)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Rozet etiketi
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={approveForm.badgeLabel}
                    onChange={(e) => setApproveForm({ ...approveForm, badgeLabel: e.target.value })}
                  />
                </label>
              </div>
            ) : null}

            <label className="mt-4 block text-[12px]">
              Gerekçe (zorunlu)
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>

            <label className="mt-3 flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              İşlemi onaylıyorum
            </label>

            {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => setModal(null)} disabled={loading}>
                İptal
              </button>
              <button
                type="button"
                className={appPrimaryButtonClass}
                disabled={loading || !reason.trim() || !confirm}
                onClick={() => void (modal === "approve" ? submitApprove() : submitReject())}
              >
                {loading ? "İşleniyor…" : modal === "approve" ? "Onayla" : "Reddet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${appPanelClass} p-4`}>
      <h2 className="text-[14px] font-extrabold text-[#0f1f4d]">{title}</h2>
      <dl className="mt-3 space-y-2">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-[12px]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[60%] text-right font-semibold text-[#0f1f4d]">{value}</dd>
    </div>
  );
}
