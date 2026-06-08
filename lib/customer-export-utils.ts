export function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function getCustomerStatusLabel(status: string) {
  if (status === "ACTIVE") return "Aktif";
  if (status === "SUSPENDED") return "Askıda";
  return "Pasif";
}

export const CUSTOMER_LIST_CSV_HEADER = [
  "Müşteri Adı",
  "Telefon",
  "E-Posta",
  "Vergi No",
  "Grup",
  "Bakiye",
  "Durum",
] as const;

export const CUSTOMER_DETAIL_CSV_HEADER = [
  "Müşteri Adı",
  "Telefon",
  "E-Posta",
  "Vergi No",
  "Adres",
  "Grup",
  "Bakiye",
  "Durum",
  "Kayıt Tarihi",
] as const;

type CustomerExportRow = {
  name: string;
  phone: string | null;
  email: string | null;
  taxNo: string | null;
  group: string | null;
  balance: unknown;
  status: string;
  address?: string | null;
  createdAt?: Date;
};

export function buildCustomerListCsvRow(customer: CustomerExportRow) {
  return [
    customer.name,
    customer.phone ?? "",
    customer.email ?? "",
    customer.taxNo ?? "",
    customer.group ?? "Genel",
    String(Number(customer.balance)),
    getCustomerStatusLabel(customer.status),
  ];
}

export function buildCustomerDetailCsvRow(customer: CustomerExportRow) {
  return [
    customer.name,
    customer.phone ?? "",
    customer.email ?? "",
    customer.taxNo ?? "",
    customer.address ?? "",
    customer.group ?? "Genel",
    String(Number(customer.balance)),
    getCustomerStatusLabel(customer.status),
    customer.createdAt
      ? new Intl.DateTimeFormat("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(customer.createdAt)
      : "",
  ];
}

export function buildCsvContent(header: readonly string[], rows: string[][]) {
  return [header, ...rows]
    .map((line) => line.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");
}

export function sanitizeCustomerExportFilename(name: string) {
  const normalized = name
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "musteri";
}
