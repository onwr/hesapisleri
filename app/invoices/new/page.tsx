"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FilePlus2,
  FileText,
  Loader2,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Save,
  Search,
  Send,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import {
  calculateInvoiceTotals,
  createEmptyItem,
  formatMoney,
  getMaxQuantityForItem,
  getStockClass,
  getUsedProductQuantity,
  previewInvoiceNo,
  type CatalogProduct,
  type InvoiceLineItem,
} from "@/lib/invoice-form-utils";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
};

type DocumentLabel = "SATIS" | "HIZMET" | "PROFORMA";

type SaveAction = "DRAFT" | "CREATE" | "CONVERT";

const documentLabelOptions: Array<{ value: DocumentLabel; label: string }> = [
  { value: "SATIS", label: "Satış Faturası" },
  { value: "HIZMET", label: "Hizmet Faturası" },
  { value: "PROFORMA", label: "Proforma Fatura" },
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDueDateValue() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const presetCustomerId = searchParams.get("customerId");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [documentLabel, setDocumentLabel] = useState<DocumentLabel>("SATIS");
  const [invoiceDate, setInvoiceDate] = useState(todayInputValue);
  const [dueDate, setDueDate] = useState(defaultDueDateValue);
  const [currency] = useState("TRY");
  const [paymentStatus, setPaymentStatus] = useState<
    "PAID" | "UNPAID" | "PARTIAL"
  >("UNPAID");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [items, setItems] = useState<InvoiceLineItem[]>([createEmptyItem()]);
  const [invoiceNoPreview] = useState(previewInvoiceNo);

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<SaveAction | null>(null);
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

          if (presetCustomerId) {
            const exists = customersData.data.some(
              (customer: Customer) => customer.id === presetCustomerId
            );

            if (exists) {
              setSelectedCustomerId(presetCustomerId);
            }
          }
        }

        if (productsData.success) {
          setProducts(productsData.data);
        }
      } catch {
        setError("Veriler yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [presetCustomerId]);

  useEffect(() => {
    async function loadDraftInvoice() {
      if (!editId) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/invoices/${editId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Taslak fatura yüklenemedi.");
          return;
        }

        const invoice = data.data as {
          customerId?: string | null;
          paymentStatus?: "PAID" | "UNPAID" | "PARTIAL" | "FAILED";
          dueDate?: string | null;
          meta?: {
            documentLabel?: DocumentLabel;
            invoiceDate?: string;
            discountAmount?: number;
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

        if (invoice.paymentStatus === "PAID" || invoice.paymentStatus === "PARTIAL") {
          setPaymentStatus(invoice.paymentStatus);
        }

        if (invoice.dueDate) {
          setDueDate(new Date(invoice.dueDate).toISOString().slice(0, 10));
        }

        if (invoice.meta?.documentLabel) {
          setDocumentLabel(invoice.meta.documentLabel);
        }

        if (invoice.meta?.invoiceDate) {
          setInvoiceDate(invoice.meta.invoiceDate);
        }

        if (typeof invoice.meta?.discountAmount === "number") {
          setDiscountAmount(invoice.meta.discountAmount);
        }

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
        setError("Taslak fatura yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    loadDraftInvoice();
  }, [editId]);

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

  const totals = useMemo(() => {
    const validItems = items.filter(
      (item) => item.name.trim() && item.quantity > 0 && item.unitPrice >= 0
    );
    return calculateInvoiceTotals(validItems, discountAmount);
  }, [items, discountAmount]);

  function updateItem(
    id: string,
    key: keyof Omit<InvoiceLineItem, "id" | "productId">,
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

  function addProductToItems(product: CatalogProduct) {
    if (product.stock <= 0) {
      setError(`${product.name} stokta yok.`);
      return;
    }

    const usedQty = getUsedProductQuantity(items, product.id);

    if (usedQty >= product.stock) {
      setError(
        `${product.name} için stok limiti doldu. Maksimum ${product.stock} adet eklenebilir.`
      );
      return;
    }

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

      const newItem: InvoiceLineItem = {
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

  function validateItems() {
    const validItems = items.filter(
      (item) => item.name.trim() && item.quantity > 0 && item.unitPrice >= 0
    );

    if (validItems.length === 0) {
      setError("Fatura oluşturmak için en az bir ürün / hizmet kalemi girin.");
      return null;
    }

    if (!selectedCustomerId) {
      setError("Lütfen bir müşteri seçin.");
      return null;
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
        return null;
      }
    }

    return validItems;
  }

  async function handleSave(action: SaveAction) {
    setSavingAction(action);
    setError("");

    const validItems = validateItems();

    if (!validItems) {
      setSavingAction(null);
      return;
    }

    const apiAction = action === "CONVERT" ? "DRAFT" : action;

    try {
      const res = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          documentLabel,
          currency,
          invoiceDate,
          dueDate,
          paymentStatus,
          discountAmount,
          action: apiAction,
          items: validItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            productId: item.productId,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Fatura oluşturulamadı.");
        return;
      }

      if (action === "CONVERT") {
        router.push(
          `/invoices/e-invoice?convertFrom=${data.data.id}&customerId=${selectedCustomerId}`
        );
        return;
      }

      router.push(`/invoices/${data.data.id}`);
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSavingAction(null);
    }
  }

  if (loading) {
    return (
      <AppLoadingScreen
        preset="invoices"
        title="Fatura formu hazırlanıyor"
        subtitle="Müşteri ve ürün listesi getiriliyor..."
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
              : savingAction === "CONVERT"
                ? "e-Fatura ekranına aktarılıyor"
                : "Fatura oluşturuluyor"
          }
          subtitle={
            savingAction === "CONVERT"
              ? "Fatura kaydı oluşturulup e-Fatura / e-Arşiv ekranına yönlendiriliyor..."
              : "Fatura bilgileri kaydediliyor..."
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
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-600">
                  <FilePlus2 size={14} strokeWidth={2.5} />
                  Klasik Fatura
                </div>

                <h1 className="text-[24px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                  Yeni Fatura
                </h1>

                <p className="mt-1 text-[13px] font-medium text-slate-500">
                  GİB&apos;e göndermeden önce sistem içi fatura kaydı oluşturun.
                  İsterseniz daha sonra e-Fatura / e-Arşiv&apos;e dönüştürün.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-[12px] font-black text-white">
                Normal Fatura
              </span>

              <Link
                href="/invoices/e-invoice"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <Send size={14} strokeWidth={2.5} />
                e-Fatura / e-Arşiv
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <CalendarDays size={20} strokeWidth={2.4} />
                </div>

                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">
                    Fatura Bilgileri
                  </h2>
                  <p className="text-[12px] font-medium text-slate-500">
                    Numara, tarih, vade ve fatura tipi bilgilerini girin.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Fatura No">
                  <input
                    value={invoiceNoPreview}
                    readOnly
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[12px] font-bold text-slate-500 outline-none"
                  />
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    Kayıt sırasında otomatik atanır
                  </p>
                </Field>

                <Field label="Fatura Tarihi">
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#0f1f4d] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                  />
                </Field>

                <Field label="Vade Tarihi">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#0f1f4d] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                  />
                </Field>

                <Field label="Fatura Tipi">
                  <div className="relative">
                    <select
                      value={documentLabel}
                      onChange={(e) =>
                        setDocumentLabel(e.target.value as DocumentLabel)
                      }
                      className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-[12px] font-bold text-[#0f1f4d] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                    >
                      {documentLabelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </Field>

                <Field label="Para Birimi">
                  <div className="relative">
                    <select
                      value={currency}
                      disabled
                      className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-[12px] font-bold text-slate-500 outline-none"
                    >
                      <option value="TRY">TRY — Türk Lirası</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </Field>
              </div>
            </div>

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
                      Faturanın kesileceği müşteri.
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
                      "Müşteri bilgileri fatura kaydına bağlanır."}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <Wallet size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Ödeme Durumu
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Tahsilat takibi için ödeme durumunu belirleyin.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  {(
                    [
                      { value: "UNPAID", label: "Ödenmedi" },
                      { value: "PARTIAL", label: "Kısmi Ödendi" },
                      { value: "PAID", label: "Ödendi" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPaymentStatus(option.value)}
                      className={[
                        "flex h-11 items-center justify-between rounded-xl border px-4 text-[12px] font-black transition",
                        paymentStatus === option.value
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-[#0f1f4d] hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {option.label}
                      {paymentStatus === option.value ? (
                        <CheckCircle2 size={16} strokeWidth={2.5} />
                      ) : null}
                    </button>
                  ))}
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
                    Katalogdan ürün seçin veya manuel kalem ekleyin.
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
                                ? "cursor-not-allowed bg-slate-100 text-slate-300"
                                : "bg-slate-100 text-slate-600",
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
                          step="0.01"
                          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-medium text-[#24345f] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                          placeholder="Birim fiyat"
                        />

                        <input
                          value={item.vatRate}
                          onChange={(e) =>
                            updateItem(item.id, "vatRate", e.target.value)
                          }
                          type="number"
                          min="0"
                          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-medium text-[#24345f] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                          placeholder="KDV %"
                        />

                        <div className="flex h-11 items-center justify-end rounded-xl bg-white px-4 text-[12px] font-black text-[#0f1f4d]">
                          {formatMoney(item.quantity * item.unitPrice)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-[16px] font-black text-[#0f1f4d]">
                  Ürün Seç
                </h2>
                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  Katalogdan ürün ekleyerek kalemleri hızlıca doldurun.
                </p>

                <div className="relative mt-4">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ürün ara..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-[12px] font-medium outline-none transition focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-50"
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
                        {product.category?.name ?? "Genel"} · KDV %
                        {product.vatRate}
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
                      Toplamları kontrol edip kaydedin.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <FileText size={22} strokeWidth={2.4} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Müşteri
                  </p>
                  <p className="mt-2 text-[14px] font-black text-[#0f1f4d]">
                    {selectedCustomer?.name || "Müşteri seçilmedi"}
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    {
                      documentLabelOptions.find(
                        (option) => option.value === documentLabel
                      )?.label
                    }{" "}
                    · {currency}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                    İndirim (₺)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount || ""}
                    onChange={(e) =>
                      setDiscountAmount(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#0f1f4d] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <SummaryLine
                    label="Ara Toplam"
                    value={formatMoney(totals.subtotal)}
                  />
                  <SummaryLine
                    label="İndirim"
                    value={formatMoney(totals.discount)}
                  />
                  <SummaryLine label="KDV" value={formatMoney(totals.vatTotal)} />

                  <div className="h-px bg-slate-200" />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-black text-[#0f1f4d]">
                      Genel Toplam
                    </span>
                    <span className="text-[22px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                      {formatMoney(totals.total)}
                    </span>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
                    {error}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => handleSave("DRAFT")}
                    disabled={!!savingAction}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {savingAction === "DRAFT" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} strokeWidth={2.5} />
                    )}
                    Taslak Kaydet
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSave("CREATE")}
                    disabled={!!savingAction}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-emerald-500 to-green-600 text-[12px] font-black text-white shadow-lg shadow-emerald-100 disabled:opacity-60"
                  >
                    {savingAction === "CREATE" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} strokeWidth={2.5} />
                    )}
                    Fatura Oluştur
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSave("CONVERT")}
                    disabled={!!savingAction}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-blue-600 to-violet-600 text-[12px] font-black text-white shadow-lg shadow-blue-100 disabled:opacity-60"
                  >
                    {savingAction === "CONVERT" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} strokeWidth={2.5} />
                    )}
                    e-Fatura / e-Arşiv&apos;e Dönüştür
                  </button>
                </div>

                <p className="text-center text-[11px] font-medium leading-5 text-slate-400">
                  Normal fatura GİB&apos;e gönderilmez. Resmi e-belge için
                  dönüştürme adımını kullanın.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className="text-[13px] font-black text-[#0f1f4d]">{value}</span>
    </div>
  );
}
