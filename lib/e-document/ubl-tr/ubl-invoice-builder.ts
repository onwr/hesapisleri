import { createHash, randomUUID } from "node:crypto";
import type { Invoice } from "@prisma/client";
import { formatXmlPercent } from "@/lib/e-document/ubl-tr/decimal-format";
import { escapeXml } from "@/lib/e-document/ubl-tr/xml-escape";
import {
  minorUnitsToXmlAmount,
  sumXmlAmounts,
} from "@/lib/e-document/ubl-tr/minor-units";
import {
  UBL_TR_VERSION,
  type UblInvoiceTypeCode,
  type UblProfileId,
} from "@/lib/e-document/ubl-tr/ubl-tr-version";
import type { MappedInvoiceLine } from "@/lib/e-document/ubl-tr/line-mapper";
import type { MappedParty } from "@/lib/e-document/ubl-tr/party-mapper";

export type BuildUblInvoiceInput = {
  invoice: Invoice;
  seller: MappedParty;
  buyer: MappedParty;
  lines: MappedInvoiceLine[];
  profileId: UblProfileId;
  invoiceTypeCode: UblInvoiceTypeCode;
  previewUuid?: string;
  senderIdentifier?: string | null;
  targetAlias?: string | null;
};

export type BuildUblInvoiceResult = {
  xml: string;
  uuid: string;
  custInvId: string;
  profileId: UblProfileId;
  invoiceTypeCode: UblInvoiceTypeCode;
};

function buildStablePreviewUuid(invoiceId: string) {
  const hash = createHash("sha256").update(`ubl-preview:${invoiceId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function partyTaxScheme(party: MappedParty) {
  if (party.taxIdKind === "VKN") {
    return `<cac:PartyIdentification><cbc:ID schemeID="VKN">${escapeXml(party.taxId)}</cbc:ID></cac:PartyIdentification>`;
  }
  return `<cac:PartyIdentification><cbc:ID schemeID="TCKN">${escapeXml(party.taxId)}</cbc:ID></cac:PartyIdentification>`;
}

function partyNameXml(party: MappedParty) {
  if (party.title) {
    return `<cac:PartyName><cbc:Name>${escapeXml(party.title)}</cbc:Name></cac:PartyName>`;
  }
  return `<cac:Person><cbc:FirstName>${escapeXml(party.firstName ?? "")}</cbc:FirstName><cbc:FamilyName>${escapeXml(party.familyName ?? "")}</cbc:FamilyName></cac:Person>`;
}

function partyPostalXml(party: MappedParty) {
  return `<cac:PostalAddress>
      <cbc:StreetName>${escapeXml(party.street ?? "")}</cbc:StreetName>
      <cbc:CitySubdivisionName>${escapeXml(party.district ?? "")}</cbc:CitySubdivisionName>
      <cbc:CityName>${escapeXml(party.city ?? "")}</cbc:CityName>
      ${party.postalZone ? `<cbc:PostalZone>${escapeXml(party.postalZone)}</cbc:PostalZone>` : ""}
      <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
    </cac:PostalAddress>`;
}

function partyXml(tag: "AccountingSupplierParty" | "AccountingCustomerParty", party: MappedParty) {
  return `<cac:${tag}>
  <cac:Party>
    <cbc:WebsiteURI/>
    ${partyTaxScheme(party)}
    ${partyNameXml(party)}
    ${partyPostalXml(party)}
    ${party.taxOffice ? `<cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>${escapeXml(party.taxOffice)}</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
    ${party.phone ? `<cac:Contact><cbc:Telephone>${escapeXml(party.phone)}</cbc:Telephone>${party.email ? `<cbc:ElectronicMail>${escapeXml(party.email)}</cbc:ElectronicMail>` : ""}</cac:Contact>` : party.email ? `<cac:Contact><cbc:ElectronicMail>${escapeXml(party.email)}</cbc:ElectronicMail></cac:Contact>` : ""}
  </cac:Party>
</cac:${tag}>`;
}

function taxTotalXml(lines: MappedInvoiceLine[]) {
  const byRate = new Map<string, { taxableMinor: number; taxMinor: number; rate: string }>();
  for (const line of lines) {
    const rate = formatXmlPercent(line.vatRate);
    const current = byRate.get(rate) ?? { taxableMinor: 0, taxMinor: 0, rate };
    current.taxableMinor += sumXmlAmounts([line.lineNetAmount]);
    current.taxMinor += sumXmlAmounts([line.vatAmount]);
    byRate.set(rate, current);
  }

  const subtotals = [...byRate.values()]
    .map(
      (amounts) => `<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${UBL_TR_VERSION.currencyCode}">${minorUnitsToXmlAmount(amounts.taxableMinor)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${UBL_TR_VERSION.currencyCode}">${minorUnitsToXmlAmount(amounts.taxMinor)}</cbc:TaxAmount>
      <cbc:Percent>${escapeXml(amounts.rate)}</cbc:Percent>
      <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>`
    )
    .join("");

  const totalTaxMinor = [...byRate.values()].reduce((sum, item) => sum + item.taxMinor, 0);

  return `<cac:TaxTotal>
  <cbc:TaxAmount currencyID="${UBL_TR_VERSION.currencyCode}">${minorUnitsToXmlAmount(totalTaxMinor)}</cbc:TaxAmount>
  ${subtotals}
</cac:TaxTotal>`;
}

function invoiceLineXml(line: MappedInvoiceLine) {
  const rate = formatXmlPercent(line.vatRate);
  return `<cac:InvoiceLine>
  <cbc:ID>${line.id}</cbc:ID>
  <cbc:InvoicedQuantity unitCode="${escapeXml(line.unitCode)}">${escapeXml(line.quantity)}</cbc:InvoicedQuantity>
  <cbc:LineExtensionAmount currencyID="${UBL_TR_VERSION.currencyCode}">${escapeXml(line.lineNetAmount)}</cbc:LineExtensionAmount>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${UBL_TR_VERSION.currencyCode}">${escapeXml(line.vatAmount)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${UBL_TR_VERSION.currencyCode}">${escapeXml(line.lineNetAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${UBL_TR_VERSION.currencyCode}">${escapeXml(line.vatAmount)}</cbc:TaxAmount>
      <cbc:Percent>${escapeXml(rate)}</cbc:Percent>
      <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:Item><cbc:Name>${escapeXml(line.name)}</cbc:Name></cac:Item>
  <cac:Price><cbc:PriceAmount currencyID="${UBL_TR_VERSION.currencyCode}">${escapeXml(line.unitPrice)}</cbc:PriceAmount></cac:Price>
</cac:InvoiceLine>`;
}

export function buildUblTrInvoiceXml(input: BuildUblInvoiceInput): BuildUblInvoiceResult {
  const uuid = input.previewUuid ?? buildStablePreviewUuid(input.invoice.id);
  const custInvId = input.invoice.invoiceNo;
  const issueDate = input.invoice.createdAt.toISOString().slice(0, 10);
  const issueTime = input.invoice.createdAt.toISOString().slice(11, 19);

  const lineExtensionMinor = sumXmlAmounts(input.lines.map((line) => line.lineNetAmount));
  const taxInclusiveMinor = sumXmlAmounts(input.lines.map((line) => line.lineGrossAmount));
  const taxExclusive = minorUnitsToXmlAmount(lineExtensionMinor);
  const taxInclusive = minorUnitsToXmlAmount(taxInclusiveMinor);
  const payable = taxInclusive;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent>
        <hes:TransportPlaceholder xmlns:hes="urn:hesapisleri:ubl-tr:transport-placeholder"/>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>${UBL_TR_VERSION.ublVersionId}</cbc:UBLVersionID>
  <cbc:CustomizationID>${UBL_TR_VERSION.customizationId}</cbc:CustomizationID>
  <cbc:ProfileID>${input.profileId}</cbc:ProfileID>
  <cbc:ID>${escapeXml(custInvId)}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${input.invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${UBL_TR_VERSION.currencyCode}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${input.lines.length}</cbc:LineCountNumeric>
  ${partyXml("AccountingSupplierParty", input.seller)}
  ${partyXml("AccountingCustomerParty", input.buyer)}
  ${taxTotalXml(input.lines)}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${UBL_TR_VERSION.currencyCode}">${taxExclusive}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${UBL_TR_VERSION.currencyCode}">${taxExclusive}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${UBL_TR_VERSION.currencyCode}">${taxInclusive}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${UBL_TR_VERSION.currencyCode}">${payable}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${input.lines.map(invoiceLineXml).join("\n  ")}
</Invoice>`;

  return {
    xml,
    uuid,
    custInvId,
    profileId: input.profileId,
    invoiceTypeCode: input.invoiceTypeCode,
  };
}

export function generateSubmissionUuid() {
  return randomUUID();
}
