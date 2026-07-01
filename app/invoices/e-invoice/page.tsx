"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Save,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { formatMoney } from "@/lib/format-utils";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
};

type Product = {
  id: string;
  name: string;
  stock: number;
  sellPrice: string | number;
  vatRate: number;
  category?: {
    name: string;
  } | null;
};

type InvoiceItem = {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

type SaleDetail = {
  id: string;
  customerId?: string | null;
  saleNo: string;
  invoice?: {
    id: string;
    invoiceNo: string;
  } | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: string | number;
    vatRate: number;
    productId?: string | null;
  }>;
};

function createEmptyItem(): InvoiceItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    quantity: 1,
    unitPrice: 0,
    vatRate: 20,
  };
}

function getStockClass(stock: number) {
  if (stock <= 0) return "bg-rose-50 text-rose-500";
  if (stock <= 10) return "bg-orange-50 text-orange-500";
  return "bg-emerald-50 text-emerald-600";
}

function getUsedProductQuantity(items: InvoiceItem[], productId: string) {
  return items
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function getMaxQuantityForItem(
  products: Product[],
  items: InvoiceItem[],
  item: InvoiceItem
) {
  if (!item.productId) return null;

  const product = products.find((entry) => entry.id === item.productId);
  if (!product) return null;

  const usedElsewhere = items
    .filter(
      (entry) => entry.productId === item.productId && entry.id !== item.id
    )
    .reduce((sum, entry) => sum + entry.quantity, 0);

  return Math.max(0, product.stock - usedElsewhere);
}

export default function EInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleId = searchParams.get("saleId");
  const convertFrom = searchParams.get("convertFrom");
  const presetCustomerId = searchParams.get("customerId");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [invoiceType, setInvoiceType] = useState<"E_INVOICE" | "E_ARCHIVE">(
    "E_ARCHIVE"
  );

  const [items, setItems] = useState<InvoiceItem[]>([createEmptyItem()]);

  const [loading, setLoading] = useState(true);
  const [sourceSale, setSourceSale] = useState<SaleDetail | null>(null);
  const [sourceInvoiceNo, setSourceInvoiceNo] = useState<string | null>(null);
  const [saleLoading, setSaleLoading] = useState(false);
  const [savingAction, setSavingAction] = useState<"DRAFT" | "SEND" | null>(
    null
  );
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, productsRes] = await Promise.all([
          fetch("/api/customers/list"),
          fetch("/api/products/list"),
        ]);

        const customersData = await customersRes.json();
        const productsData = await productsRes.json();

        if (customersData.success) {
          setCustomers(customersData.data);
        }

        if (productsData.success) {
          setProducts(productsData.data);
        }

        if (presetCustomerId && !saleId && !convertFrom) {
          setSelectedCustomerId(presetCustomerId);
        }
      } catch {
        setError("Veriler yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    async function loadSale() {
      if (!saleId) return;

      setSaleLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/sales/${saleId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Satış bilgisi alınamadı.");
          return;
        }

        const sale = data.data as SaleDetail;

        setSourceSale(sale);

        if (sale.invoice) {
          setError(
            `${sale.saleNo} numaralı satış için daha önce ${sale.invoice.invoiceNo} numaralı fatura oluşturulmuş.`
          );
        }

        if (sale.customerId) {
          setSelectedCustomerId(sale.customerId);
        }

        setItems(
          sale.items.map((item) => ({
            id: item.id,
            productId: item.productId ?? undefined,
            name: item.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            vatRate: item.vatRate,
          }))
        );
      } catch {
        setError("Satış bilgisi yüklenirken bir hata oluştu.");
      } finally {
        setSaleLoading(false);
      }
    }

    loadSale();
  }, [saleId]);

  useEffect(() => {
    async function loadSourceInvoice() {
      if (!convertFrom) return;

      setSaleLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/invoices/${convertFrom}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Kaynak fatura bilgisi alınamadı.");
          return;
        }

        const invoice = data.data as {
          customerId?: string | null;
          invoiceNo: string;
          meta?: {
            items?: Array<{
              name: string;
              quantity: number;
              unitPrice: number;
              vatRate: number;
              productId?: string;
            }>;
          } | null;
        };

        if (invoice.customerId) {
          setSelectedCustomerId(invoice.customerId);
        }

        setSourceInvoiceNo(invoice.invoiceNo);

        if (invoice.meta?.items?.length) {
          setItems(
            invoice.meta.items.map((item) => ({
              id: crypto.randomUUID(),
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
            }))
          );
        }
      } catch {
        setError("Kaynak fatura yüklenirken bir hata oluştu.");
      } finally {
        setSaleLoading(false);
      }
    }

    loadSourceInvoice();
  }, [convertFrom]);

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) =>
      product.name.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [products, productSearch]);

  const usedQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of items) {
      if (!item.productId) continue;
      map.set(
        item.productId,
        (map.get(item.productId) ?? 0) + item.quantity
      );
    }

    return map;
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
  }, [items]);

  const vatTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + (itemTotal * item.vatRate) / 100;
    }, 0);
  }, [items]);

  const total = subtotal + vatTotal;

  function updateItem(
    id: string,
    key: keyof Omit<InvoiceItem, "id" | "productId">,
    value: string
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (key === "quantity" || key === "unitPrice" || key === "vatRate") {
          let nextValue = Number(value);

          if (key === "quantity") {
            nextValue = Math.max(1, Number.isFinite(nextValue) ? nextValue : 1);

            if (item.productId) {
              const maxQty = getMaxQuantityForItem(products, prev, item);

              if (maxQty !== null && nextValue > maxQty) {
                setError(
                  maxQty <= 0
                    ? `${item.name} stokta yok.`
                    : `${item.name} için en fazla ${maxQty} adet girebilirsiniz.`
                );
                nextValue = Math.max(1, maxQty);
              } else {
                setError("");
              }
            }
          }

          return { ...item, [key]: nextValue };
        }

        return { ...item, [key]: value };
      })
    );
  }

  function addProductToItems(product: Product) {
    const price = Number(product.sellPrice);

    setError("");
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);

      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      const newItem: InvoiceItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: price,
        vatRate: product.vatRate,
      };

      const hasContent = prev.some(
        (item) => item.name.trim() || item.unitPrice > 0
      );

      if (!hasContent) {
        return [newItem];
      }

      return [...prev, newItem];
    });
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function increaseQuantity(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    if (item.productId) {
      const maxQty = getMaxQuantityForItem(products, items, item);

      if (maxQty !== null && item.quantity >= maxQty) {
        setError(
          maxQty <= 0
            ? `${item.name} stokta yok.`
            : `${item.name} için en fazla ${maxQty} adet eklenebilir.`
        );
        return;
      }
    }

    setError("");
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, quantity: entry.quantity + 1 } : entry
      )
    );
  }

  function decreaseQuantity(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity - 1) }
          : item
      )
    );
  }

  async function handleCreateInvoice(action: "DRAFT" | "SEND") {
    setSavingAction(action);
    setError("");

    const validItems = items.filter(
      (item) => item.name.trim() && item.quantity > 0 && item.unitPrice >= 0
    );

    if (validItems.length === 0) {
      setError("Fatura oluşturmak için en az bir ürün / hizmet kalemi girin.");
      setSavingAction(null);
      return;
    }

    const checkedProducts = new Set<string>();

    for (const item of validItems) {
      if (!item.productId || checkedProducts.has(item.productId)) continue;

      checkedProducts.add(item.productId);

      const product = products.find((entry) => entry.id === item.productId);
      if (!product) continue;

      const totalQty = getUsedProductQuantity(validItems, item.productId);

      if (totalQty > product.stock) {
        setError(
          `${product.name} stok miktarını aşıyor. Stok: ${product.stock}, seçilen: ${totalQty}.`
        );
        setSavingAction(null);
        return;
      }
    }

    try {
      const res = await fetch("/api/invoices/create-e-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          saleId: saleId || undefined,
          customerId: selectedCustomerId || undefined,
          type: invoiceType,
          action,
          items: validItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Fatura oluşturulamadı.");
        return;
      }

      notifyTenantCacheSync();
      router.push("/invoices");
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSavingAction(null);
    }
  }

  if (loading || saleLoading) {
    return (
      <AppLoadingScreen
        preset="invoices"
        title={
          saleLoading
            ? "Satış bilgileri e-Fatura ekranına aktarılıyor"
            : "e-Fatura ekranı hazırlanıyor"
        }
        subtitle={
          saleLoading
            ? "Müşteri ve satış kalemleri getiriliyor..."
            : "Müşteri listesi getiriliyor..."
        }
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {savingAction ? (
        <AppLoadingScreen
          preset="invoices"
          title={
            savingAction === "DRAFT"
              ? "Taslak kaydediliyor"
              : "Fatura oluşturuluyor"
          }
          subtitle={
            savingAction === "DRAFT"
              ? "Fatura taslak olarak kaydediliyor..."
              : "e-Fatura / e-Arşiv kaydı oluşturuluyor..."
          }
        />
      ) : null}

      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/invoices"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <h1 className="text-[24px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                  e-Fatura / e-Arşiv Kes
                </h1>

                <p className="mt-1 text-[13px] font-medium text-slate-500">
                  Müşteri seçin, kalemleri ekleyin ve faturanızı oluşturun.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TopInfoCard
                label="Fatura Türü"
                value={invoiceType === "E_INVOICE" ? "e-Fatura" : "e-Arşiv"}
                icon={<FileText size={17} />}
                color="violet"
              />

              <TopInfoCard
                label="Kalem Sayısı"
                value={`${items.length} kalem`}
                icon={<ReceiptText size={17} />}
                color="blue"
              />

              <TopInfoCard
                label="Genel Toplam"
                value={formatMoney(total)}
                icon={<Wallet size={17} />}
                color="emerald"
              />
            </div>
          </div>
        </section>

        {sourceSale && !sourceSale.invoice ? (
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <CheckCircle2 size={20} strokeWidth={2.5} />
                </div>

                <div>
                  <p className="text-[14px] font-black text-[#0f1f4d]">
                    Satıştan fatura oluşturuluyor
                  </p>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-emerald-700">
                    {sourceSale.saleNo} numaralı satışın müşteri ve ürün
                    kalemleri otomatik aktarıldı.
                  </p>
                </div>
              </div>

              <Link
                href={`/sales/${sourceSale.id}`}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-[12px] font-black text-white"
              >
                Satış Detayına Dön
              </Link>
            </div>
          </section>
        ) : null}

        {convertFrom && sourceInvoiceNo ? (
          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                <CheckCircle2 size={20} strokeWidth={2.5} />
              </div>

              <div>
                <p className="text-[14px] font-black text-[#0f1f4d]">
                  Normal faturadan dönüştürülüyor
                </p>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-blue-700">
                  {sourceInvoiceNo} numaralı faturanın müşteri ve kalemleri
                  e-Fatura / e-Arşiv ekranına aktarıldı.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <User size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Müşteri Seçimi
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Fatura müşterisi veya alıcı işletme.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-[13px] font-bold text-[#0f1f4d] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="">Müşteri seç</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Seçili Müşteri
                  </p>

                  <p className="mt-2 text-[14px] font-black text-[#0f1f4d]">
                    {selectedCustomer?.name || "Müşteri seçilmedi"}
                  </p>

                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    {selectedCustomer?.phone ||
                      "Müşteri bilgileri fatura aşamasında tamamlanabilir."}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <ShieldCheck size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Fatura Türü
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Alıcı durumuna göre fatura tipini seçin.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InvoiceTypeButton
                    active={invoiceType === "E_ARCHIVE"}
                    title="e-Arşiv"
                    desc="Bireysel veya e-Fatura mükellefi olmayan alıcı"
                    icon={<FileText size={18} />}
                    color="violet"
                    onClick={() => setInvoiceType("E_ARCHIVE")}
                  />

                  <InvoiceTypeButton
                    active={invoiceType === "E_INVOICE"}
                    title="e-Fatura"
                    desc="e-Fatura mükellefi işletmeler için"
                    icon={<Send size={18} />}
                    color="blue"
                    onClick={() => setInvoiceType("E_INVOICE")}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">
                    Ürün / Hizmet Kalemleri
                  </h2>

                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    Faturada görünecek ürün veya hizmet satırlarını düzenleyin.
                    Ürün seçerek veya manuel kalem ekleyerek oluşturabilirsiniz.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-blue-600 to-violet-600 px-4 text-[12px] font-black text-white shadow-lg shadow-blue-100"
                >
                  <Plus size={16} strokeWidth={3} />
                  Kalem Ekle
                </button>
              </div>

              <div className="space-y-3 p-4">
                {items.map((item, index) => {
                  const maxQty = item.productId
                    ? getMaxQuantityForItem(products, items, item)
                    : null;
                  const atStockLimit =
                    maxQty !== null && item.quantity >= maxQty;

                  return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                          <ReceiptText size={16} strokeWidth={2.5} />
                        </div>

                        <p className="text-[13px] font-black text-[#0f1f4d]">
                          Kalem {index + 1}
                          {item.productId ? (
                            <span className="ml-2 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600">
                              Katalog
                            </span>
                          ) : null}
                        </p>
                      </div>

                      {items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-rose-500 transition hover:bg-rose-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[1.4fr_170px_160px_130px_120px]">
                      <input
                        value={item.name}
                        onChange={(e) =>
                          updateItem(item.id, "name", e.target.value)
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                        placeholder="Ürün / hizmet adı"
                      />

                      <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-2">
                        <button
                          type="button"
                          onClick={() => decreaseQuantity(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
                        >
                          <Minus size={14} />
                        </button>

                        <input
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", e.target.value)
                          }
                          type="number"
                          min="1"
                          max={maxQty ?? undefined}
                          className="w-12 bg-transparent text-center text-[12px] font-black text-[#0f1f4d] outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => increaseQuantity(item.id)}
                          disabled={atStockLimit}
                          className={[
                            "flex h-7 w-7 items-center justify-center rounded-lg",
                            atStockLimit
                              ? "cursor-not-allowed bg-slate-200 text-slate-400"
                              : "bg-blue-600 text-white",
                          ].join(" ")}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <input
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(item.id, "unitPrice", e.target.value)
                        }
                        type="number"
                        min="0"
                        className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                        placeholder="Birim fiyat"
                      />

                      <div className="relative">
                        <select
                          value={item.vatRate}
                          onChange={(e) =>
                            updateItem(item.id, "vatRate", e.target.value)
                          }
                          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-9 text-[12px] font-bold text-[#24345f] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                        >
                          <option value="0">KDV %0</option>
                          <option value="1">KDV %1</option>
                          <option value="10">KDV %10</option>
                          <option value="20">KDV %20</option>
                        </select>

                        <ChevronDown
                          size={15}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>

                      <div className="flex h-11 items-center justify-end rounded-xl bg-white px-4 text-[13px] font-black text-[#0f1f4d]">
                        {formatMoney(item.quantity * item.unitPrice)}
                      </div>
                    </div>

                    {item.productId && maxQty !== null ? (
                      <p
                        className={[
                          "mt-2 text-[11px] font-semibold",
                          atStockLimit ? "text-rose-500" : "text-slate-500",
                        ].join(" ")}
                      >
                        Stok limiti: {item.quantity}/{maxQty} adet
                      </p>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">
                    Ürün Seç
                  </h2>

                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    Katalogdan ürün seçerek fatura kalemine ekleyin. Stok
                    limiti otomatik uygulanır.
                  </p>
                </div>

                <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 lg:max-w-sm">
                  <Search size={16} className="text-slate-400" />

                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ürün ara..."
                    className="min-w-0 flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredProducts.map((product) => {
                  const usedQty = usedQtyByProduct.get(product.id) ?? 0;
                  const remaining = Math.max(0, product.stock - usedQty);
                  const isOutOfStock = product.stock <= 0;
                  const isLimitReached = remaining <= 0;

                  return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToItems(product)}
                    disabled={isOutOfStock || isLimitReached}
                    className={[
                      "group rounded-2xl border p-4 text-left transition",
                      isOutOfStock || isLimitReached
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"
                        : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-[0_14px_30px_rgba(37,99,235,0.10)]",
                    ].join(" ")}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-blue-50 to-violet-50 text-blue-600">
                        <Package size={20} strokeWidth={2.4} />
                      </div>

                      <div className="text-right">
                        <span
                          className={[
                            "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
                            getStockClass(product.stock),
                          ].join(" ")}
                        >
                          Stok: {product.stock}
                        </span>
                        {usedQty > 0 ? (
                          <p className="mt-1 text-[10px] font-bold text-slate-500">
                            Kalan: {remaining}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <p className="line-clamp-1 text-[13px] font-black text-[#0f1f4d] group-hover:text-blue-600">
                      {product.name}
                    </p>

                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {product.category?.name ?? "Genel"} · KDV %{product.vatRate}
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[16px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                        {formatMoney(Number(product.sellPrice))}
                      </p>

                      <span
                        className={[
                          "flex h-9 w-9 items-center justify-center rounded-xl text-white transition",
                          isOutOfStock || isLimitReached
                            ? "bg-slate-300"
                            : "bg-blue-600 group-hover:scale-105",
                        ].join(" ")}
                      >
                        <Plus size={17} strokeWidth={3} />
                      </span>
                    </div>
                  </button>
                  );
                })}

                {filteredProducts.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Search size={24} />
                    </div>

                    <p className="mt-4 text-[16px] font-black text-[#0f1f4d]">
                      Ürün bulunamadı
                    </p>

                    <p className="mt-2 text-[13px] font-medium text-slate-500">
                      Arama kriterine uygun ürün bulunamadı.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside>
            <div className="sticky top-6 rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-black text-[#0f1f4d]">
                      Fatura Özeti
                    </h2>

                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                      Göndermeden önce bilgileri kontrol edin.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <FileText size={22} strokeWidth={2.4} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Alıcı
                  </p>

                  <p className="mt-2 text-[14px] font-black text-[#0f1f4d]">
                    {selectedCustomer?.name || "Müşteri seçilmedi"}
                  </p>

                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    {invoiceType === "E_INVOICE" ? "e-Fatura" : "e-Arşiv"}{" "}
                    olarak oluşturulacak.
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <SummaryLine label="Ara Toplam" value={formatMoney(subtotal)} />
                  <SummaryLine label="KDV" value={formatMoney(vatTotal)} />

                  <div className="h-px bg-slate-200" />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-black text-[#0f1f4d]">
                      Genel Toplam
                    </span>

                    <span className="text-[22px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                      {formatMoney(total)}
                    </span>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => handleCreateInvoice("SEND")}
                    disabled={savingAction !== null}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-blue-600 to-violet-600 text-[13px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAction === "SEND" ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Send size={18} />
                    )}
                    {savingAction === "SEND"
                      ? "Fatura oluşturuluyor..."
                      : "Tek Tuşla Fatura Kes"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateInvoice("DRAFT")}
                    disabled={savingAction !== null}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[13px] font-black text-[#24345f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAction === "DRAFT" ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Save size={18} />
                    )}
                    {savingAction === "DRAFT"
                      ? "Taslak kaydediliyor..."
                      : "Taslak Kaydet"}
                  </button>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                      <Smartphone size={17} />
                    </div>

                    <div>
                      <p className="text-[13px] font-black text-[#0f1f4d]">
                        Mobil uyumlu hızlı fatura akışı
                      </p>

                      <p className="mt-1 text-[11px] font-medium leading-5 text-blue-700">
                        Bu ekran GİB/özel entegratör bağlantısı eklendiğinde
                        aynı akışla canlı gönderim yapabilecek şekilde
                        tasarlandı.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                      <Sparkles size={17} />
                    </div>

                    <div>
                      <p className="text-[13px] font-black text-[#0f1f4d]">
                        Fatura kontrol önerisi
                      </p>

                      <p className="mt-1 text-[11px] font-medium leading-5 text-slate-600">
                        Göndermeden önce müşteri bilgilerini, KDV oranlarını ve
                        kalem toplamlarını kontrol edin.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function TopInfoCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "emerald" | "blue" | "violet";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="flex min-w-[160px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          colorMap[color],
        ].join(" ")}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          {label}
        </p>

        <p className="truncate text-[13px] font-black text-[#0f1f4d]">
          {value}
        </p>
      </div>
    </div>
  );
}

function InvoiceTypeButton({
  active,
  title,
  desc,
  icon,
  color,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: "blue" | "violet";
  onClick: () => void;
}) {
  const activeClass =
    color === "blue"
      ? "border-blue-200 bg-blue-50"
      : "border-violet-200 bg-violet-50";

  const iconClass =
    color === "blue"
      ? "bg-blue-100 text-blue-700"
      : "bg-violet-100 text-violet-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left transition hover:bg-slate-50",
        active ? activeClass : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-xl",
            iconClass,
          ].join(" ")}
        >
          {icon}
        </div>

        {active ? (
          <CheckCircle2
            size={19}
            strokeWidth={2.6}
            className={color === "blue" ? "text-blue-600" : "text-violet-600"}
          />
        ) : null}
      </div>

      <p className="text-[13px] font-black text-[#0f1f4d]">{title}</p>
      <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-5 text-slate-500">
        {desc}
      </p>
    </button>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-black text-[#0f1f4d]">{value}</span>
    </div>
  );
}