import {
  buildCsvContent,
  buildCustomerListCsvRow,
  CUSTOMER_LIST_CSV_HEADER,
} from "@/lib/customer-export-utils";
import type {
  BulkActionCustomer,
  BulkActionsFilters,
} from "@/lib/customer-bulk-actions-service";

export function extractPhoneList(customers: BulkActionCustomer[]) {
  return customers
    .map((customer) => customer.phone?.trim())
    .filter((phone): phone is string => Boolean(phone));
}

export function extractEmailList(customers: BulkActionCustomer[]) {
  return customers
    .map((customer) => customer.email?.trim())
    .filter((email): email is string => Boolean(email));
}

export function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("90")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `90${digits.slice(1)}`;
  }

  return `90${digits}`;
}

export function formatWhatsAppLinks(phones: string[]) {
  return phones
    .map((phone) => normalizeWhatsAppPhone(phone))
    .filter((phone): phone is string => Boolean(phone))
    .map((phone) => `https://wa.me/${phone}`);
}

export function formatCopyList(values: string[], separator = "\n") {
  return values.join(separator);
}

export function buildBulkActionsCsv(customers: BulkActionCustomer[]) {
  return buildCsvContent(
    CUSTOMER_LIST_CSV_HEADER,
    customers.map((customer) =>
      buildCustomerListCsvRow({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        taxNo: customer.taxNo,
        group: customer.group,
        balance: customer.balance,
        status: customer.status,
      })
    )
  );
}

export function buildBulkExportHref(
  filters: BulkActionsFilters,
  selectedIds?: string[]
) {
  const params = new URLSearchParams();

  if (filters.group) params.set("group", filters.group);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.balanceType !== "all") {
    params.set("balanceType", filters.balanceType);
  }
  if (filters.search) params.set("search", filters.search);
  if (selectedIds?.length) params.set("ids", selectedIds.join(","));

  const query = params.toString();
  return query
    ? `/api/customers/bulk-export?${query}`
    : "/api/customers/bulk-export";
}

export function buildBulkListQuery(filters: BulkActionsFilters) {
  const params = new URLSearchParams();

  if (filters.group) params.set("group", filters.group);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.balanceType !== "all") {
    params.set("balanceType", filters.balanceType);
  }
  if (filters.search) params.set("search", filters.search);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
