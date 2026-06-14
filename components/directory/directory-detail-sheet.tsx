"use client";

import Link from "next/link";
import {
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatEmailHref,
  formatPhoneHref,
  getDirectoryPrimaryLine,
  getDirectorySecondaryLine,
  getDirectorySourceHref,
  getDirectorySourceLabel,
  getDirectorySourceManageMessage,
  getDirectoryTypeBadgeClass,
  getDirectoryTypeLabel,
  isManualDirectoryContact,
  isSourceManagedDirectoryContact,
  type DirectoryContactRow,
} from "@/lib/directory-utils";
import { DirectoryContactActions } from "@/components/directory/directory-contact-actions";

type DirectoryDetailSheetProps = {
  contact: DirectoryContactRow | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (contact: DirectoryContactRow) => void;
  onToggleFavorite: (contact: DirectoryContactRow) => void;
  onDeactivate: (contact: DirectoryContactRow) => void;
  onRequestDelete: (contact: DirectoryContactRow) => void;
};

function getInitials(contact: DirectoryContactRow) {
  const source = getDirectoryPrimaryLine(contact);
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toLocaleUpperCase("tr-TR");
  }
  return (source.slice(0, 2) || "?").toLocaleUpperCase("tr-TR");
}

export function DirectoryDetailSheet({
  contact,
  canManage,
  onClose,
  onEdit,
  onToggleFavorite,
  onDeactivate,
  onRequestDelete,
}: DirectoryDetailSheetProps) {
  if (!contact) {
    return null;
  }

  const sourceHref = getDirectorySourceHref(contact.sourceType, contact.sourceId);
  const phone = contact.phone ?? contact.mobilePhone;
  const phoneHref = formatPhoneHref(phone);
  const emailHref = formatEmailHref(contact.email);
  const isManual = isManualDirectoryContact(contact.sourceType);
  const sourceManageMessage = getDirectorySourceManageMessage(contact.sourceType);
  const isSourceManaged = isSourceManagedDirectoryContact(contact.sourceType);

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[420px]"
        >
          <SheetTitle className="sr-only">
            {getDirectoryPrimaryLine(contact)} — Fihrist detayı
          </SheetTitle>
          <div className="border-b border-slate-200/80 bg-gradient-to-br from-[#f7f8ff] to-white px-5 pb-5 pt-4">
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0f1f4d] text-lg font-black text-white shadow-sm">
                {getInitials(contact)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black leading-tight text-[#0f1f4d]">
                      {getDirectoryPrimaryLine(contact)}
                    </h2>
                    {getDirectorySecondaryLine(contact) ? (
                      <p className="mt-0.5 truncate text-[13px] font-medium text-slate-500">
                        {getDirectorySecondaryLine(contact)}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleFavorite(contact)}
                    className="shrink-0 rounded-lg p-1.5 text-amber-500 transition hover:bg-amber-50"
                    aria-label="Favori"
                  >
                    <Star
                      size={18}
                      className={contact.isFavorite ? "fill-current" : ""}
                    />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset ${getDirectoryTypeBadgeClass(contact.type)}`}
                  >
                    {getDirectoryTypeLabel(contact.type)}
                  </span>
                  <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 ring-1 ring-inset ring-slate-200">
                    {getDirectorySourceLabel(contact.sourceType)}
                  </span>
                  {!contact.isActive ? (
                    <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700 ring-1 ring-inset ring-rose-100">
                      Pasif
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {(phoneHref || emailHref) && (
              <div className="mt-4">
                <DirectoryContactActions
                  phone={contact.phone}
                  mobilePhone={contact.mobilePhone}
                  email={contact.email}
                />
              </div>
            )}
          </div>

          {sourceManageMessage ? (
            <div className="border-b border-sky-100 bg-sky-50 px-5 py-3">
              <p className="text-[12px] font-medium leading-5 text-sky-900">
                {sourceManageMessage}
              </p>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-3">
              {contact.phone ? (
                <InfoCard
                  icon={Phone}
                  label="Telefon"
                  value={
                    formatPhoneHref(contact.phone) ? (
                      <a
                        href={formatPhoneHref(contact.phone)!}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {contact.phone}
                      </a>
                    ) : (
                      contact.phone
                    )
                  }
                />
              ) : null}

              {contact.mobilePhone && contact.mobilePhone !== contact.phone ? (
                <InfoCard
                  icon={Phone}
                  label="Cep Telefonu"
                  value={
                    formatPhoneHref(contact.mobilePhone) ? (
                      <a
                        href={formatPhoneHref(contact.mobilePhone)!}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {contact.mobilePhone}
                      </a>
                    ) : (
                      contact.mobilePhone
                    )
                  }
                />
              ) : null}

              {contact.email ? (
                <InfoCard
                  icon={Mail}
                  label="E-Posta"
                  value={
                    emailHref ? (
                      <a
                        href={emailHref}
                        className="break-all font-semibold text-blue-700 hover:underline"
                      >
                        {contact.email}
                      </a>
                    ) : (
                      contact.email
                    )
                  }
                />
              ) : null}

              {contact.title || contact.department ? (
                <InfoCard
                  icon={UserRound}
                  label="Ünvan / Departman"
                  value={[contact.title, contact.department]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ) : null}

              {contact.address || contact.city || contact.district ? (
                <InfoCard
                  icon={MapPin}
                  label="Adres"
                  value={[contact.address, contact.district, contact.city]
                    .filter(Boolean)
                    .join(", ")}
                />
              ) : null}

              {contact.taxNumber ? (
                <InfoCard label="Vergi No" value={contact.taxNumber} />
              ) : null}

              {contact.website ? (
                <InfoCard
                  label="Web Sitesi"
                  value={
                    <a
                      href={
                        contact.website.startsWith("http")
                          ? contact.website
                          : `https://${contact.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-semibold text-blue-700 hover:underline"
                    >
                      {contact.website}
                    </a>
                  }
                />
              ) : null}

              {contact.notes ? (
                <InfoCard label="Notlar" value={contact.notes} multiline />
              ) : null}

              {contact.tags.length > 0 ? (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Etiketler
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {!contact.phone &&
              !contact.mobilePhone &&
              !contact.email &&
              !contact.address &&
              !contact.notes ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-[13px] font-medium text-slate-500">
                    Ek iletişim bilgisi bulunmuyor.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <SheetFooter className="border-t border-slate-200/80 bg-white px-5 py-4">
            <div className="flex w-full flex-col gap-2">
              {sourceHref ? (
                <Button asChild variant="outline" className="h-10 w-full">
                  <Link href={sourceHref}>
                    <ExternalLink size={14} className="mr-1.5" />
                    {contact.sourceType === "CUSTOMER"
                      ? "Müşteri kartına git"
                      : "Çalışan kartına git"}
                  </Link>
                </Button>
              ) : null}

              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {isManual ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => onEdit(contact)}
                    >
                      <Pencil size={14} className="mr-1.5" />
                      Düzenle
                    </Button>
                  ) : null}
                  {!isSourceManaged && contact.isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 flex-1 text-amber-700 hover:text-amber-700"
                      onClick={() => onDeactivate(contact)}
                    >
                      Pasif yap
                    </Button>
                  ) : null}
                  {!isSourceManaged ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 flex-1 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => onRequestDelete(contact)}
                    >
                      <Trash2 size={14} className="mr-1.5" />
                      Sil
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  multiline = false,
}: {
  icon?: typeof Phone;
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        {Icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Icon size={15} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p
            className={`mt-1 text-[13px] font-medium text-[#0f1f4d] ${multiline ? "whitespace-pre-wrap leading-6" : ""}`}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
