/** Sovos/GİB UBL-TR paket sürümü — resmî ZIP: UBL-TR 1.2.1 */
export const UBL_TR_VERSION = {
  ublVersionId: "2.1",
  customizationId: "TR1.2",
  currencyCode: "TRY",
  countryCode: "TR",
} as const;

export type UblProfileId = "TEMELFATURA" | "TICARIFATURA" | "EARSIVFATURA";

export type UblInvoiceTypeCode = "SATIS" | "IADE";

export const SUPPORTED_INVOICE_TYPE_CODES: UblInvoiceTypeCode[] = ["SATIS", "IADE"];
