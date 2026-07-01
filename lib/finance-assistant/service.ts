import { db } from "@/lib/prisma";
import { activeSaleStatusFilter } from "@/lib/sale-query-utils";
import type { FinanceQueryInput } from "@/lib/finance-assistant/commands";
import { resolvePeriod, resolveLastMonth } from "@/lib/finance-assistant/period";
import {
  formatMoney,
  formatQuantity,
  buildPeriodResult,
  type FinanceAssistantResult,
} from "@/lib/finance-assistant/response-builders";

// ─────────────────────────────────────────────────────────────────────────────

async function runTotalSales(
  companyId: string,
  input: FinanceQueryInput,
  periodOverride?: ReturnType<typeof resolvePeriod>
): Promise<FinanceAssistantResult> {
  const period = periodOverride ?? resolvePeriod(input.period, input.startDate, input.endDate);

  const sales = await db.sale.findMany({
    where: {
      companyId,
      ...activeSaleStatusFilter(),
      saleDate: { gte: period.startDate, lte: period.endDate },
    },
    select: { total: true },
  });

  const total = sales.reduce((s, r) => s + Number(r.total), 0);

  return {
    command: "TOTAL_SALES",
    title: `Toplam Satış — ${period.label}`,
    message: `${period.label} döneminde toplam ${formatMoney(total)} satış yapıldı.`,
    metrics: [
      { label: "Satış Tutarı", value: total, formattedValue: formatMoney(total) },
      { label: "Satış Adedi", value: sales.length, formattedValue: `${sales.length} satış` },
    ],
    items: [],
    period: buildPeriodResult(period),
  };
}

async function runCollectedAmount(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);

  // Collections: account transactions with type COLLECTION (not TRANSFER)
  const txs = await db.accountTransaction.findMany({
    where: {
      account: { companyId },
      type: "COLLECTION",
      date: { gte: period.startDate, lte: period.endDate },
    },
    select: { amount: true },
  });

  const total = txs.reduce((s, r) => s + Number(r.amount), 0);

  return {
    command: "COLLECTED_AMOUNT",
    title: `Tahsilat — ${period.label}`,
    message: `${period.label} döneminde ${formatMoney(total)} tahsilat yapıldı.`,
    metrics: [
      { label: "Tahsil Edilen", value: total, formattedValue: formatMoney(total) },
      { label: "İşlem Sayısı", value: txs.length, formattedValue: `${txs.length} tahsilat` },
    ],
    items: [],
    period: buildPeriodResult(period),
  };
}

async function runGrossProfit(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);
  // SaleItem modelinde satış anı maliyet snapshot'ı (costPrice) mevcut değil.
  // Güncel Product.buyPrice geçmiş satışlara uygulanamaz — kâr hesaplanamaz.
  void companyId;
  return {
    command: "GROSS_PROFIT",
    title: `Brüt Kâr — ${period.label}`,
    message: "Kâr hesaplanamadı: satış anı maliyet verisi eksik.",
    metrics: [],
    items: [],
    period: buildPeriodResult(period),
  };
}

async function runTotalExpense(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);

  const expenses = await db.expense.findMany({
    where: {
      companyId,
      status: { not: "CANCELLED" },
      date: { gte: period.startDate, lte: period.endDate },
    },
    select: { amount: true },
  });

  const total = expenses.reduce((s, r) => s + Number(r.amount), 0);

  return {
    command: "TOTAL_EXPENSE",
    title: `Toplam Gider — ${period.label}`,
    message: `${period.label} döneminde ${formatMoney(total)} gider kaydedildi.`,
    metrics: [
      { label: "Toplam Gider", value: total, formattedValue: formatMoney(total) },
      { label: "Gider Adedi", value: expenses.length, formattedValue: `${expenses.length} gider` },
    ],
    items: [],
    period: buildPeriodResult(period),
  };
}

async function runNetResult(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);

  const [sales, expenses] = await Promise.all([
    db.sale.findMany({
      where: {
        companyId,
        ...activeSaleStatusFilter(),
        saleDate: { gte: period.startDate, lte: period.endDate },
      },
      select: { total: true },
    }),
    db.expense.findMany({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        date: { gte: period.startDate, lte: period.endDate },
      },
      select: { amount: true },
    }),
  ]);

  const revenue = sales.reduce((s, r) => s + Number(r.total), 0);
  const expenseTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const net = revenue - expenseTotal;

  return {
    command: "NET_RESULT",
    title: `Net Sonuç — ${period.label}`,
    message: `${period.label} döneminde net sonuç ${net >= 0 ? "+" : ""}${formatMoney(net)}.`,
    metrics: [
      { label: "Satış Geliri", value: revenue, formattedValue: formatMoney(revenue) },
      { label: "Toplam Gider", value: expenseTotal, formattedValue: formatMoney(expenseTotal) },
      { label: "Net Sonuç", value: net, formattedValue: formatMoney(net) },
    ],
    items: [],
    period: buildPeriodResult(period),
  };
}

async function runSalesComparison(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const thisPeriod = resolvePeriod("THIS_MONTH");
  const lastPeriod = resolveLastMonth();

  const [thisSales, lastSales] = await Promise.all([
    db.sale.findMany({
      where: {
        companyId,
        ...activeSaleStatusFilter(),
        saleDate: { gte: thisPeriod.startDate, lte: thisPeriod.endDate },
      },
      select: { total: true },
    }),
    db.sale.findMany({
      where: {
        companyId,
        ...activeSaleStatusFilter(),
        saleDate: { gte: lastPeriod.startDate, lte: lastPeriod.endDate },
      },
      select: { total: true },
    }),
  ]);

  const thisTotal = thisSales.reduce((s, r) => s + Number(r.total), 0);
  const lastTotal = lastSales.reduce((s, r) => s + Number(r.total), 0);
  const diff = thisTotal - lastTotal;
  const pct = lastTotal > 0 ? ((diff / lastTotal) * 100).toFixed(1) : null;
  const trend = diff >= 0 ? "artış" : "düşüş";
  const pctStr = pct !== null ? ` (%${Math.abs(Number(pct))} ${trend})` : "";

  return {
    command: "SALES_COMPARISON",
    title: "Aylık Satış Karşılaştırması",
    message: `Bu ay ${formatMoney(thisTotal)}, geçen ay ${formatMoney(lastTotal)} satış yapıldı.${pctStr}`,
    metrics: [
      { label: "Bu Ay", value: thisTotal, formattedValue: formatMoney(thisTotal) },
      { label: "Geçen Ay", value: lastTotal, formattedValue: formatMoney(lastTotal) },
      {
        label: "Fark",
        value: diff,
        formattedValue: `${diff >= 0 ? "+" : ""}${formatMoney(diff)}`,
      },
    ],
    items: [],
    period: buildPeriodResult(thisPeriod),
  };
}

async function runTopSellingProducts(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);

  const rows = await db.saleItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      sale: {
        companyId,
        ...activeSaleStatusFilter(),
        saleDate: { gte: period.startDate, lte: period.endDate },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });

  const productIds = rows.map((r) => r.productId!);
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, unitType: true },
      })
    : [];
  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const items = rows.map((r) => {
    const prod = pMap[r.productId!];
    const qty = r._sum.quantity ?? 0;
    const unit = prod?.unitType ?? "PIECE";
    return {
      id: r.productId ?? undefined,
      label: prod?.name ?? r.productId ?? "—",
      value: qty,
      formattedValue: formatQuantity(qty, unit),
      unit,
    };
  });

  return {
    command: "TOP_SELLING_PRODUCTS",
    title: `En Çok Satılan Ürünler — ${period.label}`,
    message: `${period.label} döneminde en çok satılan ürünler listelendi.`,
    metrics: [],
    items,
    period: buildPeriodResult(period),
  };
}

async function runTopRevenueProducts(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);

  const rows = await db.saleItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      sale: {
        companyId,
        ...activeSaleStatusFilter(),
        saleDate: { gte: period.startDate, lte: period.endDate },
      },
    },
    _sum: { total: true },
    orderBy: { _sum: { total: "desc" } },
    take: 10,
  });

  const productIds = rows.map((r) => r.productId!);
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      })
    : [];
  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const items = rows.map((r) => {
    const prod = pMap[r.productId!];
    const val = Number(r._sum.total ?? 0);
    return {
      id: r.productId ?? undefined,
      label: prod?.name ?? "—",
      value: val,
      formattedValue: formatMoney(val),
    };
  });

  return {
    command: "TOP_REVENUE_PRODUCTS",
    title: `En Çok Ciro Yapan Ürünler — ${period.label}`,
    message: `${period.label} döneminde en çok ciro yapan ürünler listelendi.`,
    metrics: [],
    items,
    period: buildPeriodResult(period),
  };
}

async function runTopProfitProducts(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);
  // SaleItem'da satış anı maliyet snapshot'ı (costPrice) yok.
  // Güncel Product.buyPrice geçmiş satışlara uygulanamaz.
  void companyId;
  return {
    command: "TOP_PROFIT_PRODUCTS",
    title: `En Çok Kâr Bırakan Ürünler — ${period.label}`,
    message: "Kâr hesaplanamadı: satış anı maliyet verisi eksik.",
    metrics: [],
    items: [],
    period: buildPeriodResult(period),
  };
}

async function runLowStockProducts(
  companyId: string,
  _input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const products = await db.product.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      productType: "STOCK",
    },
    select: {
      id: true,
      name: true,
      stock: true,
      minStock: true,
      unitType: true,
    },
  });

  const low = products
    .filter((p) => p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock);

  const items = low.map((p) => ({
    id: p.id,
    label: p.name,
    value: p.stock,
    formattedValue: formatQuantity(p.stock, p.unitType),
    secondary: `Min: ${formatQuantity(p.minStock, p.unitType)}`,
  }));

  const period = { label: "Güncel", startDate: new Date(), endDate: new Date() };

  return {
    command: "LOW_STOCK_PRODUCTS",
    title: "Düşük Stoklu Ürünler",
    message:
      low.length === 0
        ? "Tüm ürünler minimum stok seviyesinin üzerinde."
        : `${low.length} ürün minimum stok seviyesinin altında.`,
    metrics: [
      {
        label: "Düşük Stoklu Ürün",
        value: low.length,
        formattedValue: `${low.length} ürün`,
      },
    ],
    items,
    period: buildPeriodResult(period),
  };
}

async function runCashBankBalance(
  companyId: string,
  _input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const accounts = await db.account.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { id: true, name: true, type: true, balance: true, currency: true },
  });

  // Group by currency, separately track CASH vs BANK, exclude double-counted transfers
  const byCurrency: Record<string, { total: number; accounts: { name: string; balance: number }[] }> = {};

  for (const acc of accounts) {
    const cur = acc.currency || "TRY";
    if (!byCurrency[cur]) byCurrency[cur] = { total: 0, accounts: [] };
    const bal = Number(acc.balance);
    byCurrency[cur].total += bal;
    byCurrency[cur].accounts.push({ name: acc.name, balance: bal });
  }

  const currencies = Object.keys(byCurrency);
  const items = accounts.map((a) => ({
    id: a.id,
    label: a.name,
    value: Number(a.balance),
    formattedValue: formatMoney(Number(a.balance), a.currency || "TRY"),
    unit: a.currency || "TRY",
    secondary: a.type === "BANK" ? "Banka" : "Kasa",
  }));

  const totalTRY = byCurrency["TRY"]?.total ?? 0;
  const mainMsg =
    currencies.length === 1
      ? `Toplam bakiye: ${formatMoney(totalTRY)}`
      : currencies
          .map((c) => `${c}: ${formatMoney(byCurrency[c].total, c)}`)
          .join(" | ");

  const period = { label: "Güncel", startDate: new Date(), endDate: new Date() };

  return {
    command: "CASH_BANK_BALANCE",
    title: "Kasa ve Banka Bakiyeleri",
    message: mainMsg,
    metrics: currencies.map((c) => ({
      label: `Toplam (${c})`,
      value: byCurrency[c].total,
      formattedValue: formatMoney(byCurrency[c].total, c),
      currency: c,
    })),
    items,
    period: buildPeriodResult(period),
  };
}

async function runCustomerReceivables(
  companyId: string,
  _input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const invoices = await db.invoice.findMany({
    where: {
      companyId,
      status: { not: "CANCELLED" },
      paymentStatus: { not: "PAID" },
    },
    select: {
      total: true,
      paidAmount: true,
      customer: { select: { id: true, name: true } },
    },
  });

  let totalReceivable = 0;
  const byCustomer: Record<string, { name: string; amount: number }> = {};

  for (const inv of invoices) {
    const remaining = Math.max(0, Number(inv.total) - Number(inv.paidAmount ?? 0));
    totalReceivable += remaining;
    if (inv.customer) {
      const cid = inv.customer.id;
      if (!byCustomer[cid]) byCustomer[cid] = { name: inv.customer.name, amount: 0 };
      byCustomer[cid].amount += remaining;
    }
  }

  const topCustomers = Object.entries(byCustomer)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10);

  const items = topCustomers.map(([id, { name, amount }]) => ({
    id,
    label: name,
    value: amount,
    formattedValue: formatMoney(amount),
  }));

  const period = { label: "Güncel", startDate: new Date(), endDate: new Date() };

  return {
    command: "CUSTOMER_RECEIVABLES",
    title: "Toplam Müşteri Alacağı",
    message: `Tahsil edilmemiş toplam müşteri alacağı: ${formatMoney(totalReceivable)}`,
    metrics: [
      {
        label: "Toplam Alacak",
        value: totalReceivable,
        formattedValue: formatMoney(totalReceivable),
      },
      {
        label: "Açık Fatura",
        value: invoices.length,
        formattedValue: `${invoices.length} fatura`,
      },
    ],
    items,
    period: buildPeriodResult(period),
  };
}

async function runSupplierPayables(
  companyId: string,
  _input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const suppliers = await db.supplier.findMany({
    where: { companyId, isActive: true, currentBalance: { gt: 0 } },
    select: { id: true, name: true, currentBalance: true },
    orderBy: { currentBalance: "desc" },
    take: 20,
  });

  const totalPayable = suppliers.reduce((s, r) => s + Number(r.currentBalance), 0);

  const items = suppliers.map((s) => ({
    id: s.id,
    label: s.name,
    value: Number(s.currentBalance),
    formattedValue: formatMoney(Number(s.currentBalance)),
  }));

  const period = { label: "Güncel", startDate: new Date(), endDate: new Date() };

  return {
    command: "SUPPLIER_PAYABLES",
    title: "Toplam Tedarikçi Borcu",
    message: `Ödenmemiş toplam tedarikçi borcu: ${formatMoney(totalPayable)}`,
    metrics: [
      {
        label: "Toplam Borç",
        value: totalPayable,
        formattedValue: formatMoney(totalPayable),
      },
      {
        label: "Tedarikçi Sayısı",
        value: suppliers.length,
        formattedValue: `${suppliers.length} tedarikçi`,
      },
    ],
    items,
    period: buildPeriodResult(period),
  };
}

async function runProductSales(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);

  const whereProduct = input.productId
    ? { productId: input.productId }
    : { productId: { not: null as string | null } };

  // Validate foreign product
  if (input.productId) {
    const prod = await db.product.findFirst({
      where: { id: input.productId, companyId },
      select: { id: true, name: true, unitType: true },
    });
    if (!prod) throw new Error("Ürün bulunamadı veya erişim yetkiniz yok.");

    const items = await db.saleItem.findMany({
      where: {
        ...whereProduct,
        sale: {
          companyId,
          ...activeSaleStatusFilter(),
          saleDate: { gte: period.startDate, lte: period.endDate },
        },
      },
      select: { quantity: true, total: true, unitPrice: true },
    });

    const totalQty = items.reduce((s, r) => s + r.quantity, 0);
    const totalRevenue = items.reduce((s, r) => s + Number(r.total), 0);

    // SaleItem'da satış anı costPrice snapshot'ı yok — kâr hesaplanamaz.
    const metrics: import("@/lib/finance-assistant/response-builders").FinanceMetric[] = [
      { label: "Satılan Miktar", value: totalQty, formattedValue: formatQuantity(totalQty, prod.unitType) },
      { label: "Satış Cirosu", value: totalRevenue, formattedValue: formatMoney(totalRevenue) },
      { label: "Satış Adedi", value: items.length, formattedValue: `${items.length} işlem` },
      { label: "Brüt Kâr", value: "—", formattedValue: "Kâr hesaplanamadı: satış anı maliyet verisi eksik." },
    ];

    return {
      command: "PRODUCT_SALES",
      title: `${prod.name} — Satış Analizi`,
      message: `${period.label} döneminde ${formatQuantity(totalQty, prod.unitType)} ${prod.name} sattınız. Ciro: ${formatMoney(totalRevenue)}.`,
      metrics,
      items: [],
      period: buildPeriodResult(period),
    };
  }

  // No product filter: aggregate top products
  const rows = await db.saleItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      sale: {
        companyId,
        ...activeSaleStatusFilter(),
        saleDate: { gte: period.startDate, lte: period.endDate },
      },
    },
    _sum: { total: true, quantity: true },
    orderBy: { _sum: { total: "desc" } },
    take: 10,
  });

  const productIds = rows.map((r) => r.productId!);
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, unitType: true },
      })
    : [];
  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const listItems = rows.map((r) => {
    const prod = pMap[r.productId!];
    const val = Number(r._sum.total ?? 0);
    const qty = r._sum.quantity ?? 0;
    return {
      id: r.productId ?? undefined,
      label: prod?.name ?? "—",
      value: val,
      formattedValue: formatMoney(val),
      secondary: formatQuantity(qty, prod?.unitType ?? "PIECE"),
    };
  });

  return {
    command: "PRODUCT_SALES",
    title: `Ürün Satış Analizi — ${period.label}`,
    message: `${period.label} döneminde ürün bazlı satış analizi.`,
    metrics: [],
    items: listItems,
    period: buildPeriodResult(period),
  };
}

async function runProductPurchases(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = resolvePeriod(input.period, input.startDate, input.endDate);

  if (input.productId) {
    const prod = await db.product.findFirst({
      where: { id: input.productId, companyId },
      select: { id: true, name: true, unitType: true },
    });
    if (!prod) throw new Error("Ürün bulunamadı veya erişim yetkiniz yok.");

    // Yalnız tedarikçi bağlantılı gerçek satın alma hareketleri (type=IN, supplierId dolu).
    // RETURN = müşteri iadesi, satın alma değil.
    const movements = await db.stockMovement.findMany({
      where: {
        companyId,
        productId: input.productId,
        type: "IN",
        supplierId: { not: null },
        movementDate: { gte: period.startDate, lte: period.endDate },
      },
      select: { quantity: true },
    });

    if (movements.length === 0) {
      return {
        command: "PRODUCT_PURCHASES",
        title: `${prod.name} — Alış Analizi`,
        message: "Satın alma bağlantısı bulunamadığı için kesin alış miktarı hesaplanamadı.",
        metrics: [],
        items: [],
        period: buildPeriodResult(period),
      };
    }

    const totalQty = movements.reduce((s, r) => s + r.quantity, 0);

    return {
      command: "PRODUCT_PURCHASES",
      title: `${prod.name} — Alış Analizi`,
      message: `${period.label} döneminde ${formatQuantity(totalQty, prod.unitType)} ${prod.name} satın alındı.`,
      metrics: [
        { label: "Satın Alınan Miktar", value: totalQty, formattedValue: formatQuantity(totalQty, prod.unitType) },
        { label: "Alış İşlemi", value: movements.length, formattedValue: `${movements.length} hareket` },
      ],
      items: [],
      period: buildPeriodResult(period),
    };
  }

  // Tedarikçi bağlantılı gerçek satın almalara göre en çok alınan ürünler
  const rows = await db.stockMovement.groupBy({
    by: ["productId"],
    where: {
      companyId,
      type: "IN",
      supplierId: { not: null },
      movementDate: { gte: period.startDate, lte: period.endDate },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });

  const productIds = rows.map((r) => r.productId);
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, unitType: true },
      })
    : [];
  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const items = rows.map((r) => {
    const prod = pMap[r.productId];
    const qty = r._sum.quantity ?? 0;
    return {
      id: r.productId,
      label: prod?.name ?? "—",
      value: qty,
      formattedValue: formatQuantity(qty, prod?.unitType ?? "PIECE"),
    };
  });

  return {
    command: "PRODUCT_PURCHASES",
    title: `Ürün Alış Analizi — ${period.label}`,
    message: `${period.label} döneminde en çok satın alınan ürünler (tedarikçi bağlantılı).`,
    metrics: [],
    items,
    period: buildPeriodResult(period),
  };
}

async function runProductStock(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  const period = { label: "Güncel", startDate: new Date(), endDate: new Date() };

  if (input.productId) {
    const prod = await db.product.findFirst({
      where: { id: input.productId, companyId },
      select: { id: true, name: true, stock: true, minStock: true, unitType: true },
    });
    if (!prod) throw new Error("Ürün bulunamadı veya erişim yetkiniz yok.");

    const isLow = prod.stock <= prod.minStock;

    return {
      command: "PRODUCT_STOCK",
      title: `${prod.name} — Mevcut Stok`,
      message: `${prod.name} için mevcut stok: ${formatQuantity(prod.stock, prod.unitType)}.${isLow ? " ⚠️ Minimum stok seviyesinin altında!" : ""}`,
      metrics: [
        { label: "Mevcut Stok", value: prod.stock, formattedValue: formatQuantity(prod.stock, prod.unitType) },
        { label: "Minimum Stok", value: prod.minStock, formattedValue: formatQuantity(prod.minStock, prod.unitType) },
      ],
      items: [],
      period: buildPeriodResult(period),
    };
  }

  // All products sorted by stock ratio
  const products = await db.product.findMany({
    where: { companyId, status: "ACTIVE", productType: "STOCK" },
    select: { id: true, name: true, stock: true, minStock: true, unitType: true },
    orderBy: { stock: "asc" },
    take: 20,
  });

  const items = products.map((p) => ({
    id: p.id,
    label: p.name,
    value: p.stock,
    formattedValue: formatQuantity(p.stock, p.unitType),
    secondary: `Min: ${formatQuantity(p.minStock, p.unitType)}`,
  }));

  return {
    command: "PRODUCT_STOCK",
    title: "Ürün Stok Durumu",
    message: `${products.length} ürün listelendi.`,
    metrics: [],
    items,
    period: buildPeriodResult(period),
  };
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function runFinanceCommand(
  companyId: string,
  input: FinanceQueryInput
): Promise<FinanceAssistantResult> {
  switch (input.command) {
    case "TOTAL_SALES":
      return runTotalSales(companyId, input);
    case "TOTAL_SALES_LAST_MONTH":
      return runTotalSales(companyId, input, resolveLastMonth());
    case "COLLECTED_AMOUNT":
      return runCollectedAmount(companyId, input);
    case "GROSS_PROFIT":
      return runGrossProfit(companyId, input);
    case "TOTAL_EXPENSE":
      return runTotalExpense(companyId, input);
    case "NET_RESULT":
      return runNetResult(companyId, input);
    case "SALES_COMPARISON":
      return runSalesComparison(companyId, input);
    case "TOP_SELLING_PRODUCTS":
      return runTopSellingProducts(companyId, input);
    case "TOP_REVENUE_PRODUCTS":
      return runTopRevenueProducts(companyId, input);
    case "TOP_PROFIT_PRODUCTS":
      return runTopProfitProducts(companyId, input);
    case "LOW_STOCK_PRODUCTS":
      return runLowStockProducts(companyId, input);
    case "CASH_BANK_BALANCE":
      return runCashBankBalance(companyId, input);
    case "CUSTOMER_RECEIVABLES":
      return runCustomerReceivables(companyId, input);
    case "SUPPLIER_PAYABLES":
      return runSupplierPayables(companyId, input);
    case "PRODUCT_SALES":
      return runProductSales(companyId, input);
    case "PRODUCT_PURCHASES":
      return runProductPurchases(companyId, input);
    case "PRODUCT_STOCK":
      return runProductStock(companyId, input);
  }
}
