const META_SEPARATOR = "|META|";

export type NormalInvoiceItemMeta = {
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  productId?: string;
};

export type NormalInvoiceMeta = {
  v: 1;
  documentLabel: "SATIS" | "HIZMET" | "PROFORMA";
  currency: "TRY";
  invoiceDate: string;
  discountAmount: number;
  items: NormalInvoiceItemMeta[];
};

export function encodeNormalInvoiceMeta(
  displayMessage: string,
  meta: NormalInvoiceMeta
) {
  return `${displayMessage}${META_SEPARATOR}${encodeURIComponent(JSON.stringify(meta))}`;
}

export function parseNormalInvoiceMeta(gibMessage: string | null | undefined): {
  displayMessage: string;
  meta: NormalInvoiceMeta | null;
} {
  if (!gibMessage) {
    return { displayMessage: "", meta: null };
  }

  const separatorIndex = gibMessage.indexOf(META_SEPARATOR);

  if (separatorIndex === -1) {
    return { displayMessage: gibMessage, meta: null };
  }

  const displayMessage = gibMessage.slice(0, separatorIndex);
  const encoded = gibMessage.slice(separatorIndex + META_SEPARATOR.length);

  try {
    const meta = JSON.parse(decodeURIComponent(encoded)) as NormalInvoiceMeta;
    return { displayMessage, meta };
  } catch {
    return { displayMessage: gibMessage, meta: null };
  }
}
