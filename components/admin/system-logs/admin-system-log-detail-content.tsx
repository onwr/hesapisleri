import Link from "next/link";
import type { ReactNode } from "react";
import { appPanelClass } from "@/lib/admin-ui";
import { formatAdminDateTime } from "@/lib/admin-utils";

type LogDetail = {
  id: string;
  createdAt: string;
  action: string;
  module: string;
  actor: { id: string; name: string | null; email: string } | null;
  company: { id: string; name: string } | null;
  entityType: string | null;
  entityId: string | null;
  entityIdShort: string | null;
  entityHref: string | null;
  source: string;
  result: string;
  scope: "structured" | "legacy";
  ipMasked: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
};

const SOURCE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  TENANT: "Tenant",
  SYSTEM: "Sistem",
  CRON: "Cron",
};

const RESULT_LABELS: Record<string, string> = {
  success: "Başarılı",
  error: "Hata",
  unknown: "Belirsiz",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-slate-800">{children}</dd>
    </div>
  );
}

function renderMetadataValue(value: unknown, depth = 0): ReactNode {
  if (value == null) return <span className="text-slate-400">—</span>;
  if (typeof value === "object" && !Array.isArray(value)) {
    return (
      <dl className={`space-y-2 ${depth > 0 ? "ml-3 border-l border-slate-100 pl-3" : ""}`}>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold text-slate-600">{k}</dt>
            <dd className="text-[12px] text-slate-800">{renderMetadataValue(v, depth + 1)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-inside list-disc text-[12px]">
        {value.map((item, i) => (
          <li key={i}>{renderMetadataValue(item, depth + 1)}</li>
        ))}
      </ul>
    );
  }
  return <span className="break-all font-mono text-[12px]">{String(value)}</span>;
}

export function AdminSystemLogDetailContent({ log }: { log: LogDetail }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={`${appPanelClass} space-y-4 p-4`}>
        <h2 className="text-sm font-bold text-slate-800">Kayıt bilgileri</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Log ID">
            <span className="font-mono text-[12px]">{log.id}</span>
          </Field>
          <Field label="Tarih">{formatAdminDateTime(log.createdAt)}</Field>
          <Field label="Aksiyon">{log.action}</Field>
          <Field label="Modül">{log.module}</Field>
          <Field label="Kaynak">{SOURCE_LABELS[log.source] ?? log.source}</Field>
          <Field label="Sonuç">{RESULT_LABELS[log.result] ?? log.result}</Field>
          <Field label="Kapsam">
            {log.scope === "legacy" ? (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                Legacy (entityType/entityId yok)
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">Structured</span>
            )}
          </Field>
          <Field label="IP">{log.ipMasked ?? "—"}</Field>
          <Field label="Aktör">
            {log.actor ? (
              <Link href={`/admin/users/${log.actor.id}`} className="text-blue-700 hover:underline">
                {log.actor.name ?? log.actor.email}
              </Link>
            ) : (
              "Sistem"
            )}
          </Field>
          <Field label="Firma">
            {log.company ? (
              <Link href={`/admin/companies/${log.company.id}`} className="text-blue-700 hover:underline">
                {log.company.name}
              </Link>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Entity tipi">{log.entityType ?? "—"}</Field>
          <Field label="Entity ID">
            {log.entityId ? <span className="font-mono text-[12px]">{log.entityId}</span> : "—"}
          </Field>
          <Field label="İlgili kayıt">
            {log.entityHref ? (
              <Link href={log.entityHref} className="font-bold text-blue-700 hover:underline">
                Detay sayfasına git →
              </Link>
            ) : (
              <span className="text-slate-500">Bilinmeyen veya legacy — link üretilmedi</span>
            )}
          </Field>
        </dl>
      </div>

      <div className={`${appPanelClass} space-y-4 p-4`}>
        <h2 className="text-sm font-bold text-slate-800">Mesaj</h2>
        <p className="whitespace-pre-wrap text-[13px] text-slate-700">{log.message || "—"}</p>

        <h2 className="text-sm font-bold text-slate-800">Metadata (redakte)</h2>
        {log.metadata && Object.keys(log.metadata).length > 0 ? (
          renderMetadataValue(log.metadata)
        ) : (
          <p className="text-[13px] text-slate-500">Metadata yok veya boş.</p>
        )}
      </div>
    </div>
  );
}
