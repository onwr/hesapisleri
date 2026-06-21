import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import type { ReactNode } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUserActions } from "@/components/admin/admin-user-actions";
import {
  formatAdminDateTime,
  getPlatformRoleLabel,
} from "@/lib/admin-utils";
import type { getAdminUserDetail } from "@/lib/admin-service";

type UserDetail = NonNullable<Awaited<ReturnType<typeof getAdminUserDetail>>>;

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

export function AdminUserDetailContent({
  user,
  currentUserId,
}: {
  user: UserDetail;
  currentUserId: string;
}) {
  return (
    <AdminPageContainer size="full">
    <div>
      <AdminPageHeader
        title={user.name}
        description={user.email}
        backHref="/admin/users"
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-6">
          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Kullanıcı Bilgileri
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 text-[13px]">
              <Info label="Platform Rolü">
                {getPlatformRoleLabel(user.role)}
              </Info>
              <Info label="Durum">{user.status}</Info>
              <Info label="Oluşturulma">
                {formatAdminDateTime(user.createdAt)}
              </Info>
              <Info label="E-posta">{user.email}</Info>
            </div>
          </div>

          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Bağlı Firmalar
            </h2>
            {user.companies.length === 0 ? (
              <p className="text-[13px] text-slate-500">Bağlı firma yok.</p>
            ) : (
              <div className="space-y-2">
                {user.companies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-[#0f1f4d]">
                        {company.name}
                      </p>
                      <p className="text-[12px] text-slate-500">
                        {company.role}
                        {company.isOwner ? " · Sahip" : ""}
                      </p>
                    </div>
                    <span className="text-[12px] font-bold text-slate-500">
                      {company.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cardClassName}>
            <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
              Son Aktiviteler
            </h2>
            <div className="space-y-2">
              {user.activityLogs.length === 0 ? (
                <p className="text-[13px] text-slate-500">Aktivite kaydı yok.</p>
              ) : (
                user.activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3"
                  >
                    <p className="text-[13px] font-semibold text-[#0f1f4d]">
                      {log.message || `${log.module} / ${log.action}`}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {formatAdminDateTime(log.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={cardClassName}>
          <h2 className="mb-4 text-[18px] font-extrabold text-[#0f1f4d]">
            Admin Aksiyonları
          </h2>
          <AdminUserActions
            userId={user.id}
            userName={user.name}
            role={user.role}
            status={user.status}
            isSelf={user.id === currentUserId}
            mode="detail"
          />
        </div>
      </div>
    </div>
    </AdminPageContainer>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 font-semibold text-[#0f1f4d]">{children}</div>
    </div>
  );
}
