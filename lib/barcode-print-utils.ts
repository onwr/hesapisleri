export const BARCODE_LABEL_WIDTH_MM = 50;
export const BARCODE_LABEL_HEIGHT_MM = 30;

export const BARCODE_MISSING_MESSAGE = "Bu ürünün barkodu bulunmuyor.";

export type BarcodePrintItem = {
  name: string;
  barcode: string | null | undefined;
  sku?: string | null;
  sellPriceLabel?: string;
};

export type BarcodePrintResult =
  | { ok: true }
  | { ok: false; reason: "missing_barcode" | "print_failed" | "empty_selection" };

export type BulkBarcodePrintResult = {
  ok: boolean;
  printedCount: number;
  skipped: Array<{ name: string; reason: "missing_barcode" }>;
};

export function hasPrintableBarcode(item: BarcodePrintItem) {
  return Boolean(item.barcode?.trim());
}

export function escapePrintHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildBarcodeLabelCss() {
  return `
    @page { size: ${BARCODE_LABEL_WIDTH_MM}mm ${BARCODE_LABEL_HEIGHT_MM}mm; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, sans-serif;
      color: #0f1f4d;
    }
    .labels {
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
      padding: 2mm;
    }
    .label {
      width: ${BARCODE_LABEL_WIDTH_MM}mm;
      height: ${BARCODE_LABEL_HEIGHT_MM}mm;
      padding: 2mm 2.5mm;
      border: 0.2mm solid #e2e8f0;
      overflow: hidden;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .name {
      font-size: 8pt;
      font-weight: 800;
      line-height: 1.15;
      max-height: 9mm;
      overflow: hidden;
    }
    .meta {
      font-size: 6.5pt;
      color: #64748b;
      line-height: 1.2;
    }
    .code {
      font-size: 11pt;
      font-weight: 800;
      letter-spacing: 0.06em;
      font-family: ui-monospace, monospace;
    }
    @media print {
      body { padding: 0; }
      .label { border: none; }
    }
  `;
}

function buildLabelMarkup(item: BarcodePrintItem) {
  const barcode = item.barcode?.trim() ?? "";
  const safeName = escapePrintHtml(item.name);
  const safeBarcode = escapePrintHtml(barcode);
  const safeSku = item.sku ? escapePrintHtml(item.sku) : "";
  const safePrice = item.sellPriceLabel
    ? escapePrintHtml(item.sellPriceLabel)
    : "";

  return `<div class="label">
    <div class="name">${safeName}</div>
    <div class="meta">
      ${safePrice ? `<div>${safePrice}</div>` : ""}
      ${safeSku ? `<div>SKU: ${safeSku}</div>` : ""}
    </div>
    <div class="code">${safeBarcode}</div>
  </div>`;
}

export function buildProductBarcodePrintHtml(item: BarcodePrintItem) {
  if (!hasPrintableBarcode(item)) {
    throw new Error(BARCODE_MISSING_MESSAGE);
  }

  const css = buildBarcodeLabelCss();
  const label = buildLabelMarkup(item);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Barkod - ${escapePrintHtml(item.name)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="labels">${label}</div>
</body>
</html>`;
}

export function buildProductBarcodesBulkPrintHtml(items: BarcodePrintItem[]) {
  const printable = items.filter(hasPrintableBarcode);
  if (printable.length === 0) {
    throw new Error(BARCODE_MISSING_MESSAGE);
  }

  const css = buildBarcodeLabelCss();
  const labels = printable.map(buildLabelMarkup).join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Barkod Etiketleri</title>
  <style>${css}</style>
</head>
<body>
  <div class="labels">${labels}</div>
</body>
</html>`;
}

export function printHtmlDocumentWithIframe(html: string, cleanupDelayMs = 1000) {
  if (typeof document === "undefined") return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;

  if (!frameWindow || !frameDocument) {
    iframe.remove();
    return false;
  }

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.remove();
      }
    }, cleanupDelayMs);
  };

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  const triggerPrint = () => {
    frameWindow.focus();
    frameWindow.print();
    cleanup();
  };

  if (frameDocument.readyState === "complete") {
    triggerPrint();
  } else {
    iframe.onload = triggerPrint;
  }

  return true;
}

export function printProductBarcode(item: BarcodePrintItem): BarcodePrintResult {
  if (typeof window === "undefined") {
    return { ok: false, reason: "print_failed" };
  }

  if (!hasPrintableBarcode(item)) {
    window.alert(BARCODE_MISSING_MESSAGE);
    return { ok: false, reason: "missing_barcode" };
  }

  try {
    const html = buildProductBarcodePrintHtml(item);
    const printed = printHtmlDocumentWithIframe(html);
    if (!printed) {
      window.alert("Barkod yazdırma penceresi açılamadı. Lütfen tekrar deneyin.");
      return { ok: false, reason: "print_failed" };
    }
    return { ok: true };
  } catch {
    window.alert(BARCODE_MISSING_MESSAGE);
    return { ok: false, reason: "missing_barcode" };
  }
}

export function printProductBarcodesBulk(
  items: BarcodePrintItem[]
): BulkBarcodePrintResult {
  if (typeof window === "undefined" || items.length === 0) {
    return { ok: false, printedCount: 0, skipped: [] };
  }

  const printable = items.filter(hasPrintableBarcode);
  const skipped = items
    .filter((item) => !hasPrintableBarcode(item))
    .map((item) => ({ name: item.name, reason: "missing_barcode" as const }));

  if (printable.length === 0) {
    window.alert(BARCODE_MISSING_MESSAGE);
    return { ok: false, printedCount: 0, skipped };
  }

  if (skipped.length > 0) {
    window.alert(
      `${skipped.length} ürünün barkodu olmadığı için atlandı. ${printable.length} etiket yazdırılıyor.`
    );
  }

  try {
    const html = buildProductBarcodesBulkPrintHtml(items);
    const printed = printHtmlDocumentWithIframe(html);

    if (!printed) {
      window.alert("Barkod yazdırma penceresi açılamadı. Lütfen tekrar deneyin.");
      return { ok: false, printedCount: 0, skipped };
    }

    return { ok: true, printedCount: printable.length, skipped };
  } catch {
    window.alert(BARCODE_MISSING_MESSAGE);
    return { ok: false, printedCount: 0, skipped };
  }
}
