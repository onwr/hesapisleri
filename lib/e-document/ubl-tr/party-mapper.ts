import type { Company, Customer } from "@prisma/client";
import type { InvoicePartySnapshot } from "@/lib/e-document/invoice-e-document-snapshot-types";
import { normalizeTaxId } from "@/lib/e-document/ubl-tr/tax-id";

export type PartyFieldIssue = {
  field: string;
  message: string;
};

export type MappedParty = {
  taxId: string;
  taxIdKind: "VKN" | "TCKN";
  taxOffice?: string;
  title?: string;
  firstName?: string;
  familyName?: string;
  street?: string;
  city?: string;
  district?: string;
  postalZone?: string;
  countryCode: string;
  phone?: string;
  email?: string;
};

export type PartyMappingResult = {
  party: MappedParty | null;
  issues: PartyFieldIssue[];
};

function splitPersonName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? name, familyName: "-" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    familyName: parts[parts.length - 1]!,
  };
}

function parseAddressParts(address: string | null | undefined) {
  const raw = address?.trim() ?? "";
  if (!raw) {
    return { street: undefined, district: undefined, city: undefined, postalZone: undefined };
  }

  const segments = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (segments.length >= 3) {
    return {
      street: segments[0],
      district: segments[1],
      city: segments[2],
      postalZone: segments[3],
    };
  }

  return {
    street: raw,
    district: undefined,
    city: undefined,
    postalZone: undefined,
  };
}

export function mapSellerParty(company: Company): PartyMappingResult {
  const issues: PartyFieldIssue[] = [];
  const tax = normalizeTaxId(company.taxNo);
  if (!tax.ok) {
    issues.push({ field: "seller.taxId", message: tax.message });
  }

  const name = company.name?.trim();
  if (!name) {
    issues.push({ field: "seller.name", message: "Satıcı unvanı zorunludur." });
  }

  if (!company.taxOffice?.trim()) {
    issues.push({ field: "seller.taxOffice", message: "Satıcı vergi dairesi zorunludur." });
  }

  const address = parseAddressParts(company.address);
  if (!address.street) {
    issues.push({ field: "seller.address", message: "Satıcı adresi zorunludur." });
  }
  if (!address.city) {
    issues.push({ field: "seller.city", message: "Satıcı il bilgisi zorunludur (adres içinde virgülle ayırın)." });
  }
  if (!address.district) {
    issues.push({ field: "seller.district", message: "Satıcı ilçe bilgisi zorunludur (adres içinde virgülle ayırın)." });
  }

  if (!tax.ok || !name) {
    return { party: null, issues };
  }

  const person = tax.kind === "TCKN" ? splitPersonName(name) : null;

  return {
    party: {
      taxId: tax.taxId,
      taxIdKind: tax.kind,
      taxOffice: company.taxOffice?.trim() || undefined,
      title: tax.kind === "VKN" ? name : undefined,
      firstName: person?.firstName,
      familyName: person?.familyName,
      street: address.street,
      city: address.city,
      district: address.district,
      postalZone: address.postalZone,
      countryCode: "TR",
      phone: company.phone?.trim() || undefined,
      email: company.email?.trim() || undefined,
    },
    issues,
  };
}

export function mapBuyerParty(customer: Customer | null): PartyMappingResult {
  const issues: PartyFieldIssue[] = [];
  if (!customer) {
    issues.push({ field: "buyer.customer", message: "Alıcı müşteri kaydı zorunludur." });
    return { party: null, issues };
  }

  const tax = normalizeTaxId(customer.taxNo);
  if (!tax.ok) {
    issues.push({ field: "buyer.taxId", message: tax.message });
  }

  const name = customer.name?.trim();
  if (!name) {
    issues.push({ field: "buyer.name", message: "Alıcı adı/unvanı zorunludur." });
  }

  if (!customer.taxOffice?.trim()) {
    issues.push({ field: "buyer.taxOffice", message: "Alıcı vergi dairesi zorunludur." });
  }

  const address = parseAddressParts(customer.address);
  if (!address.street) {
    issues.push({ field: "buyer.address", message: "Alıcı adresi zorunludur." });
  }
  if (!address.city) {
    issues.push({ field: "buyer.city", message: "Alıcı il bilgisi zorunludur (adres içinde virgülle ayırın)." });
  }
  if (!address.district) {
    issues.push({ field: "buyer.district", message: "Alıcı ilçe bilgisi zorunludur (adres içinde virgülle ayırın)." });
  }

  if (!tax.ok || !name) {
    return { party: null, issues };
  }

  const person = tax.kind === "TCKN" ? splitPersonName(name) : null;

  return {
    party: {
      taxId: tax.taxId,
      taxIdKind: tax.kind,
      taxOffice: customer.taxOffice?.trim() || undefined,
      title: tax.kind === "VKN" ? name : undefined,
      firstName: person?.firstName,
      familyName: person?.familyName,
      street: address.street,
      city: address.city,
      district: address.district,
      postalZone: address.postalZone,
      countryCode: "TR",
      phone: customer.phone?.trim() || undefined,
      email: customer.email?.trim() || undefined,
    },
    issues,
  };
}

export function mapPartyFromSnapshot(
  snapshot: InvoicePartySnapshot | null,
  role: "seller" | "buyer"
): PartyMappingResult {
  const issues: PartyFieldIssue[] = [];
  if (!snapshot) {
    issues.push({
      field: `${role}.snapshot`,
      message: `${role === "seller" ? "Satıcı" : "Alıcı"} e-belge snapshot kaydı bulunamadı.`,
    });
    return { party: null, issues };
  }

  const tax = normalizeTaxId(snapshot.taxId);
  if (!tax.ok) {
    issues.push({ field: `${role}.taxId`, message: tax.message });
  }

  if (!snapshot.title && !(snapshot.firstName && snapshot.familyName)) {
    issues.push({
      field: `${role}.name`,
      message: `${role === "seller" ? "Satıcı" : "Alıcı"} unvan/ad snapshot alanı zorunludur.`,
    });
  }

  if (!snapshot.taxOffice?.trim()) {
    issues.push({
      field: `${role}.taxOffice`,
      message: `${role === "seller" ? "Satıcı" : "Alıcı"} vergi dairesi snapshot alanı zorunludur.`,
    });
  }

  if (!snapshot.street?.trim()) {
    issues.push({ field: `${role}.address`, message: "Adres snapshot alanı zorunludur." });
  }
  if (!snapshot.city?.trim()) {
    issues.push({ field: `${role}.city`, message: "İl snapshot alanı zorunludur." });
  }
  if (!snapshot.district?.trim()) {
    issues.push({ field: `${role}.district`, message: "İlçe snapshot alanı zorunludur." });
  }

  if (!tax.ok) {
    return { party: null, issues };
  }

  return {
    party: {
      taxId: snapshot.taxId,
      taxIdKind: snapshot.taxIdKind,
      taxOffice: snapshot.taxOffice,
      title: snapshot.title,
      firstName: snapshot.firstName,
      familyName: snapshot.familyName,
      street: snapshot.street,
      city: snapshot.city,
      district: snapshot.district,
      postalZone: snapshot.postalZone,
      countryCode: snapshot.countryCode || "TR",
      phone: snapshot.phone,
      email: snapshot.email,
    },
    issues,
  };
}

export function mapSellerPartyFromSnapshot(snapshot: InvoicePartySnapshot | null) {
  return mapPartyFromSnapshot(snapshot, "seller");
}

export function mapBuyerPartyFromSnapshot(snapshot: InvoicePartySnapshot | null) {
  return mapPartyFromSnapshot(snapshot, "buyer");
}
