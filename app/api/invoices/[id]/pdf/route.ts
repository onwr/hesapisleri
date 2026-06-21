import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { buildInvoiceDetailView } from "@/lib/invoice-detail-utils";
import { formatMoney } from "@/lib/invoice-form-utils";

type Props = {
  params: Promise<{ id: string }>;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const invoice = await db.invoice.findFirst({
      where: {
        id,
        companyId: companyId,
      },
      include: {
        customer: true,
        company: true,
        items: {
          orderBy: { lineIndex: "asc" },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, message: "Fatura bulunamadı." },
        { status: 404 }
      );
    }

    const view = buildInvoiceDetailView(
      {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        type: invoice.type,
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        total: Number(invoice.total),
        subtotal: Number(invoice.subtotal),
        totalDiscount: Number(invoice.totalDiscount),
        taxableAmount: Number(invoice.taxableAmount),
        totalVat: Number(invoice.totalVat),
        financialSnapshotStatus: invoice.financialSnapshotStatus,
        createdAt: invoice.createdAt,
        dueDate: invoice.dueDate,
        gibStatus: invoice.gibStatus,
        gibMessage: invoice.gibMessage,
        pdfUrl: invoice.pdfUrl,
        saleId: invoice.saleId,
        customer: invoice.customer
          ? {
              id: invoice.customer.id,
              name: invoice.customer.name,
              phone: invoice.customer.phone,
              email: invoice.customer.email,
            }
          : null,
        company: {
          name: invoice.company.name,
          taxNo: invoice.company.taxNo,
          address: invoice.company.address,
        },
      },
      { dbItems: invoice.items }
    );

    const itemRows =
      view.items.length > 0
        ? view.items
            .map(
              (item) => `
              <tr>
                <td>${escapeHtml(item.name)}</td>
                <td style="text-align:center">${item.quantity}</td>
                <td style="text-align:right">${formatMoney(item.unitPrice)}</td>
                <td style="text-align:center">%${item.vatRate}</td>
                <td style="text-align:right">${formatMoney(item.lineGrossAmount)}</td>
              </tr>
            `
            )
            .join("")
        : `
          <tr>
            <td colspan="5">Kalem detayı bulunmuyor. Genel toplam: ${escapeHtml(view.formattedTotal)}</td>
          </tr>
        `;

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNo)} - Fatura</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f1f4d; margin: 32px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .muted { color: #64748b; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
    .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; font-size: 13px; }
    th { text-align: left; background: #f8fafc; }
    .totals { margin-top: 24px; width: 320px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
    .grand { font-size: 20px; font-weight: 700; border-top: 2px solid #0f1f4d; padding-top: 10px; margin-top: 8px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(invoice.invoiceNo)}</h1>
  <p class="muted">${escapeHtml(view.documentLabel)} · ${escapeHtml(view.typeLabel)} · ${escapeHtml(view.statusLabel)}</p>

  <div class="grid">
    <div class="box">
      <strong>Satıcı</strong><br />
      ${escapeHtml(invoice.company.name)}<br />
      ${invoice.company.taxNo ? `VKN/TCKN: ${escapeHtml(invoice.company.taxNo)}<br />` : ""}
      ${invoice.company.address ? escapeHtml(invoice.company.address) : ""}
    </div>
    <div class="box">
      <strong>Alıcı</strong><br />
      ${escapeHtml(invoice.customer?.name ?? "Müşteri seçilmedi")}<br />
      ${invoice.customer?.phone ? escapeHtml(invoice.customer.phone) : ""}
    </div>
  </div>

  <p><strong>Fatura Tarihi:</strong> ${escapeHtml(view.formattedIssueDate)} · <strong>Vade:</strong> ${escapeHtml(view.formattedDueDate)} · <strong>Ödeme:</strong> ${escapeHtml(view.paymentLabel)}</p>

  <table>
    <thead>
      <tr>
        <th>Ürün / Hizmet</th>
        <th style="text-align:center">Adet</th>
        <th style="text-align:right">Birim Fiyat</th>
        <th style="text-align:center">KDV</th>
        <th style="text-align:right">Tutar</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div><span>Ara Toplam</span><span>${escapeHtml(view.formattedSubtotal)}</span></div>
    <div><span>İndirim</span><span>${escapeHtml(view.formattedDiscount)}</span></div>
    <div><span>KDV</span><span>${escapeHtml(view.formattedVat)}</span></div>
    <div class="grand"><span>Genel Toplam</span><span>${escapeHtml(view.formattedTotal)}</span></div>
  </div>

  <script>
    window.addEventListener("load", function () {
      window.setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${invoice.invoiceNo}.html"`,
      },
    });
  } catch (error) {
    console.error("INVOICE_PDF_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Fatura PDF hazırlanırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
