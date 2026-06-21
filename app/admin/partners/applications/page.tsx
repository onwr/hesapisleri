import Link from "next/link";
import { AdminPartnerApplicationActions } from "@/components/admin/admin-partner-application-actions";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  adminPanelClass,
  adminTableClass,
  adminTableHeadClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { listPartnerApplications } from "@/lib/partner-service";

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

export default async function AdminPartnerApplicationsPage() {
  const applications = await listPartnerApplications();

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Partner Başvuruları"
        description="Gelen ortaklık başvurularını inceleyin, onaylayın veya reddedin."
      />

      <div className={adminPanelClass}>
        <div className="overflow-x-auto">
          <table className={adminTableClass}>
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-3 py-2">Ad Soyad</th>
                <th className="px-3 py-2">E-posta</th>
                <th className="px-3 py-2">Telefon</th>
                <th className="px-3 py-2">Kitle</th>
                <th className="px-3 py-2">Sosyal</th>
                <th className="px-3 py-2">Erişim</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-3 font-bold">{application.fullName}</td>
                  <td className="px-3 py-3">{application.email}</td>
                  <td className="px-3 py-3">{application.phone ?? "—"}</td>
                  <td className="px-3 py-3">{application.audienceTypeLabel}</td>
                  <td className="px-3 py-3">
                    {application.socialUrl ? (
                      <a
                        href={application.socialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-700 hover:underline"
                      >
                        Link
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3">{application.expectedReach ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${statusClass(application.status)}`}
                    >
                      {application.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">{formatAdminDate(application.createdAt)}</td>
                  <td className="px-3 py-3">
                    <AdminPartnerApplicationActions application={application} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageContainer>
  );
}
