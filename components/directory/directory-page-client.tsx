"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import {
  Plus,
  Search,
  Star,
  UserPlus,
} from "lucide-react";
import { DirectoryContactActions } from "@/components/directory/directory-contact-actions";
import { DirectoryContactModal } from "@/components/directory/directory-contact-modal";
import { DirectoryDetailSheet } from "@/components/directory/directory-detail-sheet";
import { DirectoryQuickActions } from "@/components/directory/directory-quick-actions";
import { DirectorySourceFilterChips } from "@/components/directory/directory-source-filter-chips";
import { DirectorySidebarWidgets } from "@/components/directory/directory-sidebar-widgets";
import { DirectorySummaryCards } from "@/components/directory/directory-summary-cards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRODUCT_CARD_CLASS,
  PRODUCT_INPUT_CLASS,
} from "@/components/products/product-ui-tokens";
import {
  buildDirectoryExportQuery,
  buildDirectoryQuery,
} from "@/lib/directory-page-data";
import type { DirectoryQuickActionKey } from "@/lib/directory-page-ui-utils";
import { getDirectorySourceBadgeClass } from "@/lib/directory-page-ui-utils";
import type { DirectorySummary } from "@/lib/directory-service";
import {
  DIRECTORY_SEARCH_PLACEHOLDER,
  formatDirectorySyncMessage,
  formatEmailHref,
  formatPhoneHref,
  getDirectoryPrimaryLine,
  getDirectorySecondaryLine,
  getDirectorySourceLabel,
  getDirectoryContactDetailHref,
  getDirectoryTypeBadgeClass,
  getDirectoryTypeLabel,
  isManualDirectoryContact,
  type DirectoryContactRow,
} from "@/lib/directory-utils";

type DirectoryPageClientProps = {
  contacts: DirectoryContactRow[];
  summary: DirectorySummary;
  tags: string[];
  canManage: boolean;
  initialFilters: {
    search: string;
    type: string;
    sourceType: string;
    tag: string;
    favorite: string;
    status: string;
    sort: string;
  };
};

export function DirectoryPageClient({
  contacts,
  summary,
  tags,
  canManage,
  initialFilters,
}: DirectoryPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialFilters.search);
  const [type, setType] = useState(initialFilters.type);
  const [sourceType, setSourceType] = useState(initialFilters.sourceType);
  const [tag, setTag] = useState(initialFilters.tag);
  const [favorite, setFavorite] = useState(initialFilters.favorite);
  const [status, setStatus] = useState(initialFilters.status);
  const [sort, setSort] = useState(initialFilters.sort);

  const [modalOpen, setModalOpen] = useState(false);
  const [editContact, setEditContact] = useState<DirectoryContactRow | null>(
    null
  );
  const [detailContact, setDetailContact] =
    useState<DirectoryContactRow | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DirectoryContactRow | null>(
    null
  );
  const [actionPending, setActionPending] = useState(false);

  const exportHref = useMemo(
    () =>
      buildDirectoryExportQuery({
        search,
        type,
        sourceType,
        tag,
        favorite,
        status,
        sort,
      }),
    [search, type, sourceType, tag, favorite, status, sort]
  );

  function applyFilters() {
    const href = buildDirectoryQuery({
      search,
      type,
      sourceType,
      tag,
      favorite,
      status,
      sort,
    });

    startTransition(() => {
      router.push(href);
    });
  }

  function refreshPage() {
    notifyTenantCacheSync();
  }

  async function handleSync(endpoint: "customers" | "employees" | "suppliers") {
    setSyncMessage(null);
    setActionPending(true);

    try {
      const response = await fetch(`/api/directory/sync-${endpoint}`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Aktarım başarısız.");
      }

      setSyncMessage(formatDirectorySyncMessage(data));
      refreshPage();
    } catch (error) {
      setSyncMessage(
        error instanceof Error ? error.message : "Aktarım başarısız."
      );
    } finally {
      setActionPending(false);
    }
  }

  async function handleToggleFavorite(contact: DirectoryContactRow) {
    setActionPending(true);
    try {
      const response = await fetch(`/api/directory/${contact.id}/favorite`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Favori güncellenemedi.");
      }
      refreshPage();
      if (detailContact?.id === contact.id) {
        setDetailContact(data.contact);
      }
    } finally {
      setActionPending(false);
    }
  }

  async function handleDeactivate(contact: DirectoryContactRow) {
    setActionError(null);
    setActionPending(true);
    try {
      const response = await fetch(`/api/directory/${contact.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Kayıt pasifleştirilemedi.");
      }
      setDetailContact(null);
      refreshPage();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Kayıt pasifleştirilemedi."
      );
    } finally {
      setActionPending(false);
    }
  }

  async function handleDelete(contact: DirectoryContactRow) {
    setActionError(null);
    setActionPending(true);
    try {
      const response = await fetch(
        `/api/directory/${contact.id}?permanent=true`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Kayıt silinemedi.");
      }
      setDeleteTarget(null);
      setDetailContact(null);
      refreshPage();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Kayıt silinemedi."
      );
    } finally {
      setActionPending(false);
    }
  }

  function requestDelete(contact: DirectoryContactRow) {
    setActionError(null);
    setDeleteTarget(contact);
  }

  function openCreateModal() {
    setEditContact(null);
    setModalOpen(true);
  }

  function openEditModal(contact: DirectoryContactRow) {
    if (!isManualDirectoryContact(contact.sourceType)) {
      setActionError("Bu kayıt müşteri/çalışan kartından yönetilir.");
      return;
    }
    setEditContact(contact);
    setModalOpen(true);
    setDetailContact(null);
  }

  function handleQuickAction(key: DirectoryQuickActionKey) {
    if (key === "new-person") {
      openCreateModal();
      return;
    }

    if (key === "sync-customers") {
      void handleSync("customers");
      return;
    }

    if (key === "sync-suppliers") {
      void handleSync("suppliers");
      return;
    }

    if (key === "sync-employees") {
      void handleSync("employees");
    }
  }

  function handleSourceFilterChange(next: {
    sourceType: string;
    favorite: string;
  }) {
    setSourceType(next.sourceType);
    setFavorite(next.favorite);
  }

  return (
    <div className="space-y-5">
      <DirectoryQuickActions
        canManage={canManage}
        exportHref={exportHref}
        onAction={handleQuickAction}
      />

      {syncMessage ? (
        <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[12px] font-medium text-sky-800">
          {syncMessage}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
          {actionError}
        </p>
      ) : null}

      <DirectorySummaryCards summary={summary} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="space-y-2.5 border-b border-slate-100 p-3">
            <DirectorySourceFilterChips
              sourceType={sourceType}
              favorite={favorite}
              onChange={handleSourceFilterChange}
            />

            <div className="grid gap-2 md:grid-cols-12">
              <label className="md:col-span-4">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Arama
                </span>
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className={`${PRODUCT_INPUT_CLASS} pl-9`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyFilters();
                    }}
                    placeholder={DIRECTORY_SEARCH_PLACEHOLDER}
                  />
                </div>
              </label>

              <FilterSelect
                label="Tür"
                value={type}
                onChange={setType}
                className="md:col-span-2"
                options={[
                  { value: "ALL", label: "Tümü" },
                  { value: "PERSON", label: "Kişi" },
                  { value: "COMPANY", label: "Firma" },
                  { value: "CUSTOMER", label: "Müşteri" },
                  { value: "EMPLOYEE", label: "Çalışan" },
                  { value: "OTHER", label: "Diğer" },
                ]}
              />

              <FilterSelect
                label="Kaynak"
                value={sourceType}
                onChange={setSourceType}
                className="md:col-span-2"
                options={[
                  { value: "ALL", label: "Tümü" },
                  { value: "MANUAL", label: "Manuel" },
                  { value: "CUSTOMER", label: "Müşteri" },
                  { value: "EMPLOYEE", label: "Çalışan" },
                  { value: "SUPPLIER", label: "Tedarikçi" },
                ]}
              />

              <FilterSelect
                label="Favori"
                value={favorite}
                onChange={setFavorite}
                className="md:col-span-2"
                options={[
                  { value: "ALL", label: "Tümü" },
                  { value: "yes", label: "Favoriler" },
                  { value: "no", label: "Favori Değil" },
                ]}
              />

              <FilterSelect
                label="Durum"
                value={status}
                onChange={setStatus}
                className="md:col-span-2"
                options={[
                  { value: "active", label: "Aktif" },
                  { value: "passive", label: "Pasif" },
                  { value: "ALL", label: "Tümü" },
                ]}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-12">
              <FilterSelect
                label="Etiket"
                value={tag}
                onChange={setTag}
                className="md:col-span-3"
                options={[
                  { value: "", label: "Tümü" },
                  ...tags.map((item) => ({ value: item, label: item })),
                ]}
              />

              <FilterSelect
                label="Sıralama"
                value={sort}
                onChange={setSort}
                className="md:col-span-3"
                options={[
                  { value: "name_asc", label: "Ada göre (A-Z)" },
                  { value: "name_desc", label: "Ada göre (Z-A)" },
                  { value: "favorite_first", label: "Favoriler önce" },
                  { value: "updated_desc", label: "Son güncellenen" },
                ]}
              />

              <div className="flex items-end md:col-span-6 md:justify-end">
                <button
                  type="button"
                  onClick={applyFilters}
                  disabled={isPending}
                  className="inline-flex h-9 items-center rounded-lg bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#162a5c] disabled:opacity-60"
                >
                  Filtrele
                </button>
              </div>
            </div>
          </div>

          {contacts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                <UserPlus size={28} />
              </div>
              <h2 className="text-lg font-black text-[#0f1f4d]">
                Fihristte kayıt bulunmuyor
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Müşteri, tedarikçi ve kişilerin birleşik iletişim rehberi burada
                listelenir. Satış ve cari hesap için Müşteriler modülünü
                kullanın.
              </p>
              {canManage ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white"
                >
                  <Plus size={16} />
                  Kişi Ekle
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div id="directory-list" className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-[12px]">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Favori</th>
                      <th className="px-3 py-2.5">Ad / Firma</th>
                      <th className="px-3 py-2.5">Tür</th>
                      <th className="px-3 py-2.5">Telefon</th>
                      <th className="px-3 py-2.5">E-Posta</th>
                      <th className="px-3 py-2.5">Departman / Ünvan</th>
                      <th className="px-3 py-2.5">Kaynak</th>
                      <th className="px-3 py-2.5">Etiketler</th>
                      <th className="px-3 py-2.5">İletişim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <DirectoryTableRow
                        key={contact.id}
                        contact={contact}
                        onOpenDetail={setDetailContact}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 p-4 md:hidden">
                {contacts.map((contact) => (
                  <DirectoryMobileCard
                    key={contact.id}
                    contact={contact}
                    onOpenDetail={setDetailContact}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <DirectorySidebarWidgets
            summary={summary}
            canManage={canManage}
            exportHref={exportHref}
            onAction={handleQuickAction}
          />
        </aside>
      </div>

      <DirectoryContactModal
        open={modalOpen}
        contact={editContact}
        onClose={() => {
          setModalOpen(false);
          setEditContact(null);
        }}
        onSaved={refreshPage}
      />

      <DirectoryDetailSheet
        contact={detailContact}
        canManage={canManage}
        onClose={() => setDetailContact(null)}
        onEdit={openEditModal}
        onToggleFavorite={handleToggleFavorite}
        onDeactivate={handleDeactivate}
        onRequestDelete={requestDelete}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-[#0f1f4d]">
              Kaydı sil
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-6 text-slate-600">
              {deleteTarget ? (
                <>
                  <span className="font-bold text-[#0f1f4d]">
                    {getDirectoryPrimaryLine(deleteTarget)}
                  </span>{" "}
                  fihristten kalıcı olarak silinecek.
                  {!isManualDirectoryContact(deleteTarget.sourceType) ? (
                    <>
                      {" "}
                      Müşteri veya çalışan kaynağı silinmez; yalnızca fihrist
                      kaydı kaldırılır.
                    </>
                  ) : (
                    <> Bu işlem geri alınamaz.</>
                  )}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={actionPending}
            >
              İptal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={actionPending || !deleteTarget}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DirectoryTableRow({
  contact,
  onOpenDetail,
  onToggleFavorite,
}: {
  contact: DirectoryContactRow;
  onOpenDetail: (contact: DirectoryContactRow) => void;
  onToggleFavorite: (contact: DirectoryContactRow) => void;
}) {
  const phoneHref = formatPhoneHref(contact.phone ?? contact.mobilePhone);
  const emailHref = formatEmailHref(contact.email);
  const detailHref = getDirectoryContactDetailHref(contact);
  const primaryName = getDirectoryPrimaryLine(contact);

  return (
    <tr
      className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/80"
      onClick={() => onOpenDetail(contact)}
    >
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(contact);
          }}
          className="text-amber-500 transition hover:scale-110"
        >
          <Star
            size={16}
            className={contact.isFavorite ? "fill-current" : ""}
          />
        </button>
      </td>
      <td className="px-3 py-2.5">
        {detailHref ? (
          <Link
            href={detailHref}
            onClick={(event) => event.stopPropagation()}
            className="line-clamp-2 font-black text-blue-700 hover:underline"
          >
            {primaryName}
          </Link>
        ) : (
          <p className="line-clamp-2 font-black text-[#0f1f4d]">{primaryName}</p>
        )}
        {getDirectorySecondaryLine(contact) ? (
          <p className="text-[11px] font-medium text-slate-500">
            {getDirectorySecondaryLine(contact)}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${getDirectoryTypeBadgeClass(contact.type)}`}
        >
          {getDirectoryTypeLabel(contact.type)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {phoneHref ? (
          <a
            href={phoneHref}
            onClick={(event) => event.stopPropagation()}
            className="font-semibold text-blue-700 hover:underline"
          >
            {contact.phone ?? contact.mobilePhone}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5">
        {emailHref ? (
          <a
            href={emailHref}
            onClick={(event) => event.stopPropagation()}
            className="font-semibold text-blue-700 hover:underline"
          >
            {contact.email}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5 text-slate-600">
        {[contact.department, contact.title].filter(Boolean).join(" · ") || "—"}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${getDirectorySourceBadgeClass(contact.sourceType)}`}
        >
          {getDirectorySourceLabel(contact.sourceType)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex max-w-[140px] flex-wrap gap-1">
          {contact.tags.slice(0, 2).map((item) => (
            <span
              key={item}
              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
            >
              {item}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <DirectoryContactActions
          phone={contact.phone}
          mobilePhone={contact.mobilePhone}
          email={contact.email}
          compact
          onClick={(event) => event.stopPropagation()}
        />
      </td>
    </tr>
  );
}

function DirectoryMobileCard({
  contact,
  onOpenDetail,
  onToggleFavorite,
}: {
  contact: DirectoryContactRow;
  onOpenDetail: (contact: DirectoryContactRow) => void;
  onToggleFavorite: (contact: DirectoryContactRow) => void;
}) {
  return (
    <article
      className={`${PRODUCT_CARD_CLASS} cursor-pointer p-3`}
      onClick={() => onOpenDetail(contact)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-[#0f1f4d]">
            {getDirectoryPrimaryLine(contact)}
          </p>
          {getDirectorySecondaryLine(contact) ? (
            <p className="text-[11px] text-slate-500">
              {getDirectorySecondaryLine(contact)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(contact);
          }}
          className="text-amber-500 transition hover:scale-110"
        >
          <Star
            size={16}
            className={contact.isFavorite ? "fill-current" : ""}
          />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${getDirectoryTypeBadgeClass(contact.type)}`}
        >
          {getDirectoryTypeLabel(contact.type)}
        </span>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${getDirectorySourceBadgeClass(contact.sourceType)}`}
        >
          {getDirectorySourceLabel(contact.sourceType)}
        </span>
      </div>

      <div
        className="mt-2"
        onClick={(event) => event.stopPropagation()}
      >
        <DirectoryContactActions
          phone={contact.phone}
          mobilePhone={contact.mobilePhone}
          email={contact.email}
          compact
        />
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        className={PRODUCT_INPUT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
