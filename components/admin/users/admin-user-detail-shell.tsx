"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { appOutlineButtonClass, appPanelClass } from "@/lib/admin-ui";
import {
  formatAdminDate,
  formatAdminDateTime,
} from "@/lib/admin-utils";
import {
  getUserStatusClass,
  getUserStatusLabel,
  getLoginTrackingLabel,
} from "@/lib/admin/users/admin-user-serializers";
import { getIssueLabel } from "@/lib/admin/users/admin-user-issue-service";
import type { AdminUserTab } from "@/lib/admin/users/admin-user-detail-service";
import type { getAdminUserHeader } from "@/lib/admin/users/admin-user-detail-service";

const TABS: Array<{ key: AdminUserTab; label: string }> = [
  { key: "overview", label: "Özet" },
  { key: "companies", label: "Firmalar" },
  { key: "security", label: "Güvenlik" },
  { key: "activity", label: "Aktivite" },
  { key: "support", label: "Destek" },
  { key: "notes", label: "Notlar" },
];

type Props = {
  header: NonNullable<Awaited<ReturnType<typeof getAdminUserHeader>>>;
  tab: AdminUserTab;
  tabData: unknown;
  currentUserId: string;
};

function tabHref(userId: string, tab: AdminUserTab) {
  return `/admin/users/${userId}?tab=${tab}`;
}

export function AdminUserDetailShell({
  header,
  tab,
  tabData,
  currentUserId,
}: Props) {
  const router = useRouter();

  async function handleSuspend() {
    const reason = window.prompt("Askıya alma nedeni:");
    if (!reason?.trim()) return;
    const res = await fetch(`/api/admin/users/${header.id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message ?? "İşlem başarısız.");
      return;
    }
    router.refresh();
  }

  async function handleReactivate() {
    const reason = window.prompt("Yeniden etkinleştirme nedeni:");
    if (!reason?.trim()) return;
    const res = await fetch(`/api/admin/users/${header.id}/reactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message ?? "İşlem başarısız.");
      return;
    }
    router.refresh();
  }

  async function handleRevokeSessions() {
    const isSelf = header.id === currentUserId;
    if (
      !window.confirm(
        isSelf
          ? "Kendi oturumlarınızı da iptal edeceksiniz. Devam etmek istiyor musunuz?"
          : "Kullanıcının tüm aktif oturumları iptal edilecek. Devam?"
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/users/${header.id}/revoke-sessions`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message ?? "İşlem başarısız.");
      return;
    }
    router.refresh();
  }

  return (
    <AdminPageContainer size="full">
      {/* Breadcrumb + başlık */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/admin/users"
            className="text-[12px] font-semibold text-slate-500 hover:underline"
          >
            ← Kullanıcılar
          </Link>
          <h1 className="mt-1 text-[20px] font-extrabold text-[#0f1f4d]">
            {header.name}
          </h1>
          <p className="text-[12px] text-slate-500">
            {header.email} ·{" "}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getUserStatusClass(header.status)}`}
            >
              {getUserStatusLabel(header.status)}
            </span>{" "}
            · {header.platformRole === "SUPER_ADMIN" ? "Platform Yöneticisi" : "Kullanıcı"}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            Kayıt: {formatAdminDate(header.createdAt)} · Son giriş:{" "}
            {header.lastLoginAt
              ? formatAdminDateTime(header.lastLoginAt)
              : getLoginTrackingLabel(header.loginTrackingStatus)} ·{" "}
            {header.companyCount} firma
          </p>
          {header.issues.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {header.issues.map((issue) => (
                <span
                  key={issue}
                  className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700"
                >
                  {getIssueLabel(issue)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Aksiyon butonları */}
        <div className="flex flex-wrap gap-2">
          {header.status === "ACTIVE" && header.id !== currentUserId && (
            <button onClick={handleSuspend} className={appOutlineButtonClass}>
              Askıya Al
            </button>
          )}
          {header.status === "SUSPENDED" && (
            <button onClick={handleReactivate} className={appOutlineButtonClass}>
              Yeniden Etkinleştir
            </button>
          )}
          <button onClick={handleRevokeSessions} className={appOutlineButtonClass}>
            Oturumları İptal Et
          </button>
          <button
            disabled
            title="E-posta altyapısı yapılandırılmamış"
            className="cursor-not-allowed rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-400"
          >
            Şifre Sıfırla (Mail Yok)
          </button>
        </div>
      </div>

      {/* Tab navigasyonu */}
      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={tabHref(header.id, item.key)}
            className={[
              "rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors",
              tab === item.key
                ? "bg-[#0f1f4d] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Tab içeriği */}
      <TabContent tab={tab} tabData={tabData} userId={header.id} currentUserId={currentUserId} />
    </AdminPageContainer>
  );
}

function TabContent({
  tab,
  tabData,
  userId,
  currentUserId,
}: {
  tab: AdminUserTab;
  tabData: unknown;
  userId: string;
  currentUserId: string;
}) {
  if (!tabData) {
    return (
      <div className={appPanelClass}>
        <p className="text-[13px] text-slate-500">Bu sekme verisi yüklenemedi.</p>
      </div>
    );
  }

  if (typeof tabData === "object" && tabData !== null && "error" in tabData) {
    return (
      <div className={appPanelClass}>
        <p className="text-[13px] text-rose-600">
          {(tabData as { error: string }).error}
        </p>
      </div>
    );
  }

  if (tab === "overview") return <OverviewTab data={tabData} />;
  if (tab === "companies")
    return <CompaniesTab data={tabData} userId={userId} />;
  if (tab === "security") return <SecurityTab data={tabData} />;
  if (tab === "activity") return <ActivityTab data={tabData} />;
  if (tab === "support") return <SupportTab data={tabData} />;
  if (tab === "notes")
    return (
      <NotesTab
        data={tabData}
        userId={userId}
        currentUserId={currentUserId}
      />
    );

  return null;
}

// ─── Tab bileşenleri ────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: unknown }) {
  const d = data as Record<string, unknown>;
  return (
    <div className={appPanelClass}>
      <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">Kullanıcı Özeti</h2>
      <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
        <InfoRow label="Ad Soyad" value={String(d.name ?? "—")} />
        <InfoRow label="E-posta" value={String(d.email ?? "—")} />
        <InfoRow label="Platform Rolü" value={d.platformRole === "SUPER_ADMIN" ? "Platform Yöneticisi" : "Kullanıcı"} />
        <InfoRow label="Durum" value={getUserStatusLabel(d.status as never)} />
        <InfoRow label="E-posta Doğrulama" value={String(d.emailVerificationStatus ?? "NOT_TRACKED")} />
        <InfoRow label="Giriş Takibi" value={getLoginTrackingLabel(d.loginTrackingStatus as never)} />
        <InfoRow label="Son Giriş" value={d.lastLoginAt ? formatAdminDateTime(d.lastLoginAt as string) : "—"} />
        <InfoRow label="Kayıt Tarihi" value={formatAdminDate(d.createdAt as string)} />
        {Boolean(d.suspendedAt) && (
          <>
            <InfoRow label="Askıya Alınma" value={formatAdminDateTime(d.suspendedAt as string)} />
            <InfoRow label="Askıya Alma Nedeni" value={String(d.suspendedReason ?? "—")} />
          </>
        )}
      </dl>
    </div>
  );
}

function CompaniesTab({ data, userId }: { data: unknown; userId: string }) {
  const memberships = data as Array<{
    id: string;
    companyId: string;
    companyName: string;
    companyStatus: string;
    role: string;
    status: string;
    isOwner: boolean;
    createdAt: string;
  }>;

  const router = useRouter();

  async function handleDeactivate(companyUserId: string) {
    const res = await fetch(
      `/api/admin/users/${userId}/memberships/${companyUserId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PASSIVE" }),
      }
    );
    const json = await res.json();
    if (!res.ok) {
      alert(json.message ?? "İşlem başarısız.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={appPanelClass}>
      <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">
        Firma Üyelikleri ({memberships.length})
      </h2>
      {memberships.length === 0 ? (
        <p className="text-[13px] text-slate-500">Firma üyeliği yok.</p>
      ) : (
        <div className="space-y-3">
          {memberships.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
            >
              <div>
                <p className="text-[13px] font-bold text-[#0f1f4d]">
                  {m.companyName}
                  {m.isOwner && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      Sahip
                    </span>
                  )}
                </p>
                <p className="text-[12px] text-slate-500">
                  Rol: {m.role} · Durum: {m.status} · Şirket: {m.companyStatus}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatAdminDate(m.createdAt)}
                </p>
              </div>
              {!m.isOwner && m.status === "ACTIVE" && (
                <button
                  onClick={() => handleDeactivate(m.id)}
                  className={appOutlineButtonClass}
                >
                  Pasife Al
                </button>
              )}
              {m.isOwner && (
                <span className="text-[11px] text-slate-400">
                  (Sahip değiştirilemez)
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecurityTab({ data }: { data: unknown }) {
  const d = data as Record<string, unknown>;
  const openResetTokens = (d.openResetTokens as Array<{ id: string; expiresAt: string; createdByAdmin?: { name: string } | null }>) ?? [];

  return (
    <div className={appPanelClass}>
      <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">Güvenlik</h2>
      <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
        <InfoRow label="Hesap Durumu" value={getUserStatusLabel(d.status as never)} />
        <InfoRow label="E-posta Doğrulama" value={String(d.emailVerificationStatus ?? "NOT_TRACKED")} />
        <InfoRow label="Hesap Kilidi" value="İzlenmiyor" />
        <InfoRow
          label="Açık Sıfırlama Tokenı"
          value={
            openResetTokens.length > 0
              ? `${openResetTokens.length} adet (token/link gösterilmez)`
              : "Yok"
          }
        />
      </dl>

      {openResetTokens.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-semibold text-slate-600">
            Açık Sıfırlama Tokenları (yalnızca meta bilgi):
          </p>
          {openResetTokens.map((t) => (
            <p key={t.id} className="text-[12px] text-slate-500">
              Son geçerlilik: {formatAdminDateTime(t.expiresAt)}
              {t.createdByAdmin ? ` · Oluşturan: ${t.createdByAdmin.name}` : ""}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
        <p className="text-[12px] font-semibold text-amber-700">
          Parola sıfırlama ve doğrulama e-postaları: E-posta altyapısı yapılandırılmamış.
          Bu işlemler şu an kullanılamaz.
        </p>
      </div>
    </div>
  );
}

function ActivityTab({ data }: { data: unknown }) {
  const d = data as {
    total: number;
    page: number;
    totalPages: number;
    items: Array<{
      id: string;
      module: string;
      action: string;
      message: string;
      ip: string;
      company: { id: string; name: string } | null;
      createdAt: string;
    }>;
  };

  return (
    <div className={appPanelClass}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold text-[#0f1f4d]">
          Aktivite Geçmişi ({d.total})
        </h2>
        <p className="text-[12px] text-slate-400">
          Sayfa {d.page}/{d.totalPages}
        </p>
      </div>
      {d.items.length === 0 ? (
        <p className="text-[13px] text-slate-500">Aktivite kaydı yok.</p>
      ) : (
        <div className="space-y-2">
          {d.items.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-slate-100 p-2.5 text-[12px]"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  {log.action}
                </span>
                <span className="text-slate-400">
                  {formatAdminDateTime(log.createdAt)}
                </span>
              </div>
              <div className="mt-0.5 text-slate-500">
                {log.module}
                {log.company ? ` · ${log.company.name}` : ""}
                {log.ip !== "—" ? ` · ${log.ip}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupportTab({ data }: { data: unknown }) {
  const d = data as {
    pendingInvites: Array<{
      id: string;
      companyName: string;
      role: string;
      expiresAt: string;
    }>;
    openResetTokens: Array<{ id: string; expiresAt: string }>;
    mailConfigured: boolean;
  };

  return (
    <div className={appPanelClass}>
      <h2 className="mb-4 text-[16px] font-extrabold text-[#0f1f4d]">Destek</h2>

      <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
        <p className="text-[12px] font-semibold text-amber-700">
          E-posta altyapısı yapılandırılmamış. Davet ve sıfırlama e-postaları gönderilemez.
        </p>
      </div>

      <h3 className="mb-2 text-[13px] font-bold text-slate-700">
        Bekleyen Davetler ({d.pendingInvites.length})
      </h3>
      {d.pendingInvites.length === 0 ? (
        <p className="mb-4 text-[12px] text-slate-400">Bekleyen davet yok.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {d.pendingInvites.map((inv) => (
            <div
              key={inv.id}
              className="rounded-lg border border-slate-200 p-2.5 text-[12px]"
            >
              <p className="font-semibold">{inv.companyName}</p>
              <p className="text-slate-500">
                Rol: {inv.role} · Son: {formatAdminDateTime(inv.expiresAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <h3 className="mb-2 text-[13px] font-bold text-slate-700">
        Açık Sıfırlama İstekleri ({d.openResetTokens.length})
      </h3>
      {d.openResetTokens.length === 0 ? (
        <p className="text-[12px] text-slate-400">Açık sıfırlama isteği yok.</p>
      ) : (
        <div className="space-y-2">
          {d.openResetTokens.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-slate-200 p-2.5 text-[12px] text-slate-500"
            >
              Son geçerlilik: {formatAdminDateTime(t.expiresAt)}
              <span className="ml-2 text-[11px] text-slate-400">
                (token/link gösterilmez)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesTab({
  data,
  userId,
  currentUserId: _currentUserId,
}: {
  data: unknown;
  userId: string;
  currentUserId: string;
}) {
  const notes = data as Array<{
    id: string;
    content: string;
    category: string;
    priority: string;
    isPinned: boolean;
    author: { name: string; email: string } | null;
    createdAt: string;
  }>;

  const router = useRouter();

  async function handleAddNote() {
    const content = window.prompt("Not içeriği:");
    if (!content?.trim()) return;
    const res = await fetch(`/api/admin/users/${userId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message ?? "Not oluşturulamadı.");
      return;
    }
    router.refresh();
  }

  async function handleDeleteNote(noteId: string) {
    if (!window.confirm("Bu notu silmek istiyor musunuz?")) return;
    const res = await fetch(`/api/admin/users/${userId}/notes/${noteId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.message ?? "Not silinemedi.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={appPanelClass}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold text-[#0f1f4d]">
          Notlar ({notes.length})
        </h2>
        <button onClick={handleAddNote} className={appOutlineButtonClass}>
          + Not Ekle
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-[13px] text-slate-500">Not yok.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-xl border p-3 ${
                note.isPinned ? "border-yellow-300 bg-yellow-50" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[11px] font-bold rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    {note.category}
                  </span>
                  <span className="text-[11px] font-bold rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    {note.priority}
                  </span>
                  {note.isPinned && (
                    <span className="text-[11px] font-bold rounded-full bg-yellow-200 px-2 py-0.5 text-yellow-800">
                      Sabitlenmiş
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-[11px] text-rose-500 hover:text-rose-700"
                >
                  Sil
                </button>
              </div>
              <p className="mt-2 text-[13px] text-slate-700">{note.content}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {note.author?.name ?? "Bilinmiyor"} ·{" "}
                {formatAdminDateTime(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Yardımcı ───────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
      <dd className="text-[13px] text-slate-800">{value}</dd>
    </div>
  );
}
