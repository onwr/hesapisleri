import type {
  DirectoryContactType,
  DirectorySourceType,
} from "@prisma/client";
import {
  buildCsvContent,
  escapeCsvValue,
} from "@/lib/customer-export-utils";

export type DirectorySortOption =
  | "name_asc"
  | "name_desc"
  | "favorite_first"
  | "updated_desc";

export type DirectoryContactRow = {
  id: string;
  type: DirectoryContactType;
  sourceType: DirectorySourceType | null;
  sourceId: string | null;
  name: string;
  companyName: string | null;
  title: string | null;
  department: string | null;
  phone: string | null;
  mobilePhone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  taxNumber: string | null;
  notes: string | null;
  tags: string[];
  isFavorite: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function getDirectoryDisplayName(contact: {
  name: string;
  companyName?: string | null;
}) {
  const name = contact.name.trim();
  const companyName = contact.companyName?.trim() ?? "";

  if (name && companyName) {
    return `${name} · ${companyName}`;
  }

  return name || companyName || "—";
}

export function getDirectoryPrimaryLine(contact: {
  name: string;
  companyName?: string | null;
}) {
  const name = contact.name.trim();
  const companyName = contact.companyName?.trim() ?? "";

  if (name) return name;
  return companyName || "—";
}

export function getDirectorySecondaryLine(contact: {
  name: string;
  companyName?: string | null;
}) {
  const name = contact.name.trim();
  const companyName = contact.companyName?.trim() ?? "";

  if (name && companyName) return companyName;
  return null;
}

export function getDirectoryTypeLabel(type: DirectoryContactType) {
  const labels: Record<DirectoryContactType, string> = {
    PERSON: "Kişi",
    COMPANY: "Firma",
    CUSTOMER: "Müşteri",
    EMPLOYEE: "Çalışan",
    SUPPLIER: "Tedarikçi",
    OTHER: "Diğer",
  };

  return labels[type] ?? type;
}

export function getDirectorySourceLabel(
  sourceType: DirectorySourceType | null | undefined
) {
  if (!sourceType || sourceType === "MANUAL") return "Manuel";
  if (sourceType === "CUSTOMER") return "Müşteri";
  if (sourceType === "EMPLOYEE") return "Çalışan";
  if (sourceType === "SUPPLIER") return "Tedarikçi";
  return sourceType;
}

export function getDirectoryTypeBadgeClass(type: DirectoryContactType) {
  if (type === "CUSTOMER") {
    return "bg-sky-50 text-sky-700 ring-sky-100";
  }
  if (type === "EMPLOYEE") {
    return "bg-violet-50 text-violet-700 ring-violet-100";
  }
  if (type === "COMPANY") {
    return "bg-indigo-50 text-indigo-700 ring-indigo-100";
  }
  if (type === "SUPPLIER") {
    return "bg-amber-50 text-amber-700 ring-amber-100";
  }
  if (type === "PERSON") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }
  return "bg-slate-50 text-slate-600 ring-slate-100";
}

export function toggleFavoriteValue(current: boolean) {
  return !current;
}

export function normalizeDirectoryTags(tags: string[] | undefined) {
  if (!tags?.length) return [];

  return [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20)
    ),
  ];
}

export function validateDirectoryContactInput(input: {
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  website?: string | null;
}): { ok: true } | { ok: false; message: string } {
  const name = input.name?.trim() ?? "";
  const companyName = input.companyName?.trim() ?? "";

  if (!name && !companyName) {
    return { ok: false, message: "Ad soyad veya firma adı zorunludur." };
  }

  if (input.email?.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      return { ok: false, message: "Geçerli bir e-posta adresi girin." };
    }
  }

  if (input.website?.trim()) {
    const website = input.website.trim();
    const websiteRegex =
      /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-./?%&=]*)?$/i;
    if (!websiteRegex.test(website)) {
      return { ok: false, message: "Geçerli bir web sitesi adresi girin." };
    }
  }

  return { ok: true };
}

export function isManualDirectoryContact(
  sourceType: DirectorySourceType | null | undefined
) {
  return !sourceType || sourceType === "MANUAL";
}

export function getDirectoryContactDetailHref(contact: {
  sourceType: DirectorySourceType | null;
  sourceId: string | null;
}): string | null {
  if (!contact.sourceId || isManualDirectoryContact(contact.sourceType)) {
    return null;
  }

  if (contact.sourceType === "CUSTOMER") {
    return `/customers/${contact.sourceId}`;
  }

  if (contact.sourceType === "SUPPLIER") {
    return `/suppliers/${contact.sourceId}`;
  }

  if (contact.sourceType === "EMPLOYEE") {
    return `/team/${contact.sourceId}`;
  }

  return null;
}

export function isSourceManagedDirectoryContact(
  sourceType: DirectorySourceType | null | undefined
) {
  return sourceType === "CUSTOMER" || sourceType === "EMPLOYEE" || sourceType === "SUPPLIER";
}

export function getDirectorySourceManageMessage(
  sourceType: DirectorySourceType | null | undefined
) {
  if (sourceType === "CUSTOMER") {
    return "Bu kayıt müşteri kartından yönetilir.";
  }
  if (sourceType === "EMPLOYEE") {
    return "Bu kayıt çalışan kartından yönetilir.";
  }
  if (sourceType === "SUPPLIER") {
    return "Bu kayıt tedarikçi kartından yönetilir.";
  }
  return null;
}

export const DIRECTORY_SEARCH_PLACEHOLDER =
  "Kişi, firma, telefon, e-posta veya vergi no ara";

type DirectorySearchableContact = Pick<
  DirectoryContactRow,
  | "name"
  | "companyName"
  | "phone"
  | "mobilePhone"
  | "email"
  | "department"
  | "title"
  | "tags"
  | "notes"
>;

export function matchesDirectorySearch(
  contact: DirectorySearchableContact,
  query?: string | null
) {
  const needle = query?.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return true;

  const haystacks = [
    contact.name,
    contact.companyName,
    contact.phone,
    contact.mobilePhone,
    contact.email,
    contact.department,
    contact.title,
    contact.notes,
    ...contact.tags,
  ];

  return haystacks.some((value) =>
    value?.toLocaleLowerCase("tr-TR").includes(needle)
  );
}

export function formatDirectorySyncMessage(result: {
  created: number;
  updated: number;
  skipped: number;
}) {
  return `${result.created} yeni, ${result.updated} güncellendi, ${result.skipped} değişmedi.`;
}

export function getDirectorySourceHref(
  sourceType: DirectorySourceType | null | undefined,
  sourceId: string | null | undefined
) {
  if (!sourceId) return null;
  if (sourceType === "CUSTOMER") return `/customers/${sourceId}`;
  if (sourceType === "EMPLOYEE") return `/team/${sourceId}`;
  if (sourceType === "SUPPLIER") return `/suppliers/${sourceId}`;
  return null;
}

export function formatPhoneHref(phone: string | null | undefined) {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function formatEmailHref(email: string | null | undefined) {
  if (!email?.trim()) return null;
  return `mailto:${email.trim()}`;
}

export const DIRECTORY_CSV_HEADER = [
  "Tür",
  "Ad",
  "Firma",
  "Telefon",
  "Cep Telefonu",
  "E-Posta",
  "Ünvan",
  "Departman",
  "İl",
  "İlçe",
  "Adres",
  "Etiketler",
  "Not",
] as const;

export function buildDirectoryCsvRow(contact: DirectoryContactRow) {
  return [
    getDirectoryTypeLabel(contact.type),
    contact.name,
    contact.companyName ?? "",
    contact.phone ?? "",
    contact.mobilePhone ?? "",
    contact.email ?? "",
    contact.title ?? "",
    contact.department ?? "",
    contact.city ?? "",
    contact.district ?? "",
    contact.address ?? "",
    contact.tags.join("; "),
    contact.notes ?? "",
  ];
}

export function buildDirectoryCsvContent(contacts: DirectoryContactRow[]) {
  return buildCsvContent(
    DIRECTORY_CSV_HEADER,
    contacts.map((contact) => buildDirectoryCsvRow(contact))
  );
}

export function buildDirectoryCsvWithBom(contacts: DirectoryContactRow[]) {
  return `\uFEFF${buildDirectoryCsvContent(contacts)}`;
}

export function parseDirectoryFavoriteFilter(value?: string | null) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

export function parseDirectorySearch(value?: string | null) {
  return value?.trim() ?? "";
}

export function parseDirectoryTypeFilter(value?: string | null) {
  if (
    value === "PERSON" ||
    value === "COMPANY" ||
    value === "CUSTOMER" ||
    value === "EMPLOYEE" ||
    value === "SUPPLIER" ||
    value === "OTHER"
  ) {
    return value;
  }
  return "ALL" as const;
}

export function parseDirectorySourceFilter(value?: string | null) {
  if (value === "MANUAL" || value === "CUSTOMER" || value === "EMPLOYEE" || value === "SUPPLIER") {
    return value;
  }
  return "ALL" as const;
}

export function parseDirectorySort(value?: string | null): DirectorySortOption {
  if (
    value === "name_desc" ||
    value === "favorite_first" ||
    value === "updated_desc"
  ) {
    return value;
  }
  return "name_asc";
}

export function parseDirectoryActiveFilter(value?: string | null) {
  if (value === "active") return true;
  if (value === "passive") return false;
  if (value === "ALL") return undefined;
  return undefined;
}

export { escapeCsvValue };
