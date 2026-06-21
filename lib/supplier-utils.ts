import { z } from "zod";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";

export const SUPPLIER_CATEGORIES = [
  "Hammadde",
  "Malzeme",
  "Yarı Mamul",
  "Ambalaj",
  "Makine / Ekipman",
  "Elektronik",
  "Gıda",
  "İçecek",
  "Tekstil",
  "Kimyasal",
  "İnşaat",
  "Metal",
  "Plastik",
  "Kağıt / Kırtasiye",
  "Ofis Malzemeleri",
  "Temizlik",
  "Lojistik / Kargo",
  "Taşımacılık",
  "Depolama",
  "Hizmet",
  "Danışmanlık",
  "Yazılım / IT",
  "Reklam / Pazarlama",
  "Bakım / Onarım",
  "Enerji",
  "Sigorta",
  "Muhasebe / Mali",
  "Üretici",
  "Toptancı",
  "İthalatçı",
  "Distribütör",
  "Diğer",
] as const;

export const SUPPLIER_SORT_OPTIONS = [
  "recent",
  "name",
  "balance_desc",
  "balance_asc",
  "last_activity",
  "product_count",
] as const;

export type SupplierSortOption = (typeof SUPPLIER_SORT_OPTIONS)[number];

export type SupplierBalanceStatus = "all" | "payable" | "receivable" | "clear" | "overdue";

export type SupplierRow = {
  id: string;
  code: string | null;
  name: string;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  mobilePhone: string | null;
  email: string | null;
  taxNumber: string | null;
  category: string | null;
  city: string | null;
  district: string | null;
  currentBalance: number;
  overdueAmount: number;
  overdueCount: number;
  productCount: number;
  currency: string;
  isActive: boolean;
  isFavorite: boolean;
  updatedAt: Date;
  lastActivityAt: Date | null;
  lastActivityType: string | null;
};

export const supplierFormSchema = z
  .object({
    code: z.string().optional(),
    name: z.string().trim().optional(),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    phone: z.string().optional(),
    mobilePhone: z.string().optional(),
    email: z.string().email("Geçerli bir e-posta girin.").optional().or(z.literal("")),
    website: z.string().optional(),
    taxOffice: z.string().optional(),
    taxNumber: z.string().optional(),
    iban: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    country: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    openingBalance: z.number().optional(),
    currency: z.string().optional(),
    paymentTermDays: z.number().int().positive().optional().nullable(),
    isFavorite: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const name = data.name?.trim();
    const companyName = data.companyName?.trim();
    if (!name && !companyName) {
      ctx.addIssue({
        code: "custom",
        message: "Tedarikçi adı veya firma adı zorunludur.",
        path: ["name"],
      });
    }
  });

export type SupplierFormInput = z.infer<typeof supplierFormSchema>;

export const supplierContactSchema = z.object({
  name: z.string().trim().min(1, "Kişi adı zorunludur."),
  title: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const supplierProductSchema = z.object({
  productId: z.string().min(1),
  supplierSku: z.string().optional(),
  supplierBarcode: z.string().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  minOrderQuantity: z.number().int().positive().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  isPreferred: z.boolean().optional(),
  notes: z.string().optional(),
});

export function normalizeSupplierTags(tags?: string[] | string | null) {
  if (!tags) return [] as string[];
  if (Array.isArray(tags)) {
    return tags.map((tag) => tag.trim()).filter(Boolean);
  }
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function getSupplierDisplayName(input: {
  name: string;
  companyName?: string | null;
}) {
  if (input.companyName?.trim()) {
    return input.companyName.trim();
  }
  return input.name.trim();
}

export function getSupplierPrimaryLine(row: Pick<SupplierRow, "name" | "companyName">) {
  return getSupplierDisplayName(row);
}

export function getSupplierSecondaryLine(
  row: Pick<SupplierRow, "name" | "companyName" | "contactName">
) {
  if (row.companyName?.trim() && row.name.trim()) {
    return row.name.trim();
  }
  return row.contactName?.trim() || null;
}

export function formatSupplierMoney(value: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(roundCashMoney(value));
}

export function getSupplierBalanceBadge(balance: number) {
  if (balance > 0) {
    return { label: "Borç var", className: "bg-rose-50 text-rose-700" };
  }
  return { label: "Borç yok", className: "bg-emerald-50 text-emerald-700" };
}

export function matchesSupplierSearch(
  row: SupplierRow,
  query: string | null | undefined
) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    row.name,
    row.companyName ?? "",
    row.contactName ?? "",
    row.phone ?? "",
    row.mobilePhone ?? "",
    row.email ?? "",
    row.taxNumber ?? "",
    row.code ?? "",
    row.category ?? "",
    row.city ?? "",
    row.district ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function parseSupplierSort(value?: string | null): SupplierSortOption {
  if (value && SUPPLIER_SORT_OPTIONS.includes(value as SupplierSortOption)) {
    return value as SupplierSortOption;
  }
  return "recent";
}

export function parseSupplierBalanceStatus(
  value?: string | null
): SupplierBalanceStatus {
  if (
    value === "payable" ||
    value === "receivable" ||
    value === "clear" ||
    value === "overdue"
  ) {
    return value;
  }
  return "all";
}

export const SUPPLIER_CSV_HEADER = [
  "Kod",
  "Tedarikçi",
  "Firma",
  "Yetkili",
  "Telefon",
  "Cep Telefonu",
  "E-posta",
  "Vergi No",
  "Kategori",
  "Bakiye",
  "İl",
  "İlçe",
  "Adres",
  "Etiketler",
  "Notlar",
  "Durum",
] as const;

export function buildSupplierCsvRow(row: SupplierRow & { notes?: string | null; tags?: string[]; address?: string | null }) {
  return [
    row.code ?? "",
    row.name,
    row.companyName ?? "",
    row.contactName ?? "",
    row.phone ?? "",
    row.mobilePhone ?? "",
    row.email ?? "",
    row.taxNumber ?? "",
    row.category ?? "",
    String(row.currentBalance),
    row.city ?? "",
    row.district ?? "",
    row.address ?? "",
    (row.tags ?? []).join("; "),
    row.notes ?? "",
    row.isActive ? "Aktif" : "Pasif",
  ];
}

export function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildSuppliersCsv(rows: Array<ReturnType<typeof buildSupplierCsvRow>>) {
  const lines = [SUPPLIER_CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvCell(String(cell))).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
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
