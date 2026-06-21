"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { SaleLineEditFields } from "@/components/sales/sale-line-edit-fields";
import { formatMoney } from "@/lib/format-utils";
import {
  calculateLineSubtotal,
  calculateSaleTotals,
  validateSaleLineItems,
} from "@/lib/sale-calculation-utils";

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

type InitialItem = {
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  stock: number;
};

type CartItem = {
  cartKey: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  stock: number;
  isInitial: boolean;
};

type EditQuoteFormProps = {
  quoteId: string;
  saleNo: string;
  initialCustomerId: string;
  initialNote: string;
  initialItems: InitialItem[];
};

function getStockClass(stock: number) {
  if (stock <= 0) return "bg-rose-50 text-rose-500";
  if (stock <= 10) return "bg-orange-50 text-orange-500";
  return "bg-emerald-50 text-emerald-600";
}

function buildInitialCart(items: InitialItem[]): CartItem[] {
  return items.map((item, index) => ({
    cartKey: item.productId ?? `line-${index}`,
    productId: item.productId ?? undefined,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate,
    stock: item.stock,
    isInitial: true,
  }));
}

export function EditQuoteForm({
  quoteId,
  saleNo,
  initialCustomerId,
  initialNote,
  initialItems,
}: EditQuoteFormProps) {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId);
  const [note, setNote] = useState(initialNote);
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => buildInitialCart(initialItems));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

          setCart((prev) =>
            prev.map((item) => {
              if (!item.productId) return item;

              const product = productsData.data.find(
                (entry: Product) => entry.id === item.productId
              );

              if (!product) return item;

              return {
                ...item,
                stock: product.stock,
              };
            })
          );
        }
      } catch {
        setError("Veriler yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) =>
      product.name.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [products, productSearch]);

  const totals = useMemo(() => calculateSaleTotals(cart), [cart]);
  const { subtotal, vatTotal, total } = totals;
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: Product) {
    const price = Number(product.sellPrice);

    setError("");
    setCart((prev) => {
      const current = prev.find((item) => item.productId === product.id);

      if (current) {
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          cartKey: product.id,
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: price,
          vatRate: product.vatRate,
          stock: product.stock,
          isInitial: false,
        },
      ];
    });
  }

  function increaseQuantity(cartKey: string) {
    setError("");
    setCart((prev) =>
      prev.map((entry) =>
        entry.cartKey === cartKey
          ? {
              ...entry,
              quantity: entry.quantity + 1,
            }
          : entry
      )
    );
  }

  function decreaseQuantity(cartKey: string) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.cartKey === cartKey
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(cartKey: string) {
    setCart((prev) => prev.filter((item) => item.cartKey !== cartKey));
  }

  function updateCartItem(
    cartKey: string,
    field: "unitPrice" | "vatRate",
    value: number
  ) {
    setCart((prev) =>
      prev.map((item) =>
        item.cartKey === cartKey
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  async function handleUpdateQuote() {
    setSaving(true);
    setError("");

    if (cart.length === 0) {
      setError("Teklif güncellemek için en az bir ürün ekleyin.");
      setSaving(false);
      return;
    }

    const lineError = validateSaleLineItems(cart);
    if (lineError) {
      setError(lineError);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/sales/quotes/${quoteId}/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: selectedCustomerId || undefined,
          note,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Teklif güncellenemedi.");
        return;
      }

      router.push(`/sales/${quoteId}`);
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLoadingScreen
        preset="sales"
        title="Teklif düzenleme hazırlanıyor"
        subtitle="Müşteri ve ürünler getiriliyor..."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {saving ? (
        <AppLoadingScreen
          preset="sales"
          title="Teklif güncelleniyor"
          subtitle="Değişiklikler kaydediliyor..."
        />
      ) : null}

      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href={`/sales/${quoteId}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <h1 className="text-[24px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                  Teklif Düzenle
                </h1>

                <p className="mt-1 text-[13px] font-medium text-slate-500">
                  {saleNo} numaralı teklifi güncelleyin. Stok ve cari bakiye
                  etkilenmez.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TopInfoCard
                label="Teklif Kalemi"
                value={`${cart.length} kalem`}
                icon={<FileText size={17} />}
                color="amber"
              />

              <TopInfoCard
                label="Toplam Adet"
                value={`${totalQuantity} adet`}
                icon={<Package size={17} />}
                color="blue"
              />

              <TopInfoCard
                label="Teklif Tutarı"
                value={formatMoney(total)}
                icon={<Wallet size={17} />}
                color="violet"
              />
            </div>
          </div>
        </section>

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
                      Müşteri Bilgisi
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Müşteri seçimi opsiyoneldir.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-[13px] font-bold text-[#0f1f4d] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="">Müşteri seçmeden devam et</option>
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
                      "Teklif taslak olarak güncellenecek."}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <FileText size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Teklif Notu
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Müşteriye iletilecek not veya açıklama.
                    </p>
                  </div>
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[132px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[12px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:border-amber-200 focus:ring-4 focus:ring-amber-50"
                  placeholder="Teklif ile ilgili not ekleyin..."
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">
                    Ürün Seç
                  </h2>

                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    Teklife eklemek istediğiniz ürünleri seçin.
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
                {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-100 hover:bg-amber-50/30 hover:shadow-[0_14px_30px_rgba(245,158,11,0.10)]"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-amber-50 to-orange-50 text-amber-600">
                          <Package size={20} strokeWidth={2.4} />
                        </div>

                        <span
                          className={[
                            "rounded-md px-2 py-1 text-[10px] font-black",
                            getStockClass(product.stock),
                          ].join(" ")}
                        >
                          Stok: {product.stock}
                        </span>
                      </div>

                      <p className="line-clamp-1 text-[13px] font-black text-[#0f1f4d] group-hover:text-amber-600">
                        {product.name}
                      </p>

                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {product.category?.name ?? "Genel"} · KDV %{product.vatRate}
                      </p>

                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-[16px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                          {formatMoney(Number(product.sellPrice))}
                        </p>

                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white transition group-hover:scale-105">
                          <Plus size={17} strokeWidth={3} />
                        </span>
                      </div>
                    </button>
                ))}
              </div>
            </div>
          </div>

          <aside>
            <div className="sticky top-6 rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-black text-[#0f1f4d]">
                      Teklif Özeti
                    </h2>

                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                      Kalemleri kontrol edin.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <FileText size={22} strokeWidth={2.4} />
                  </div>
                </div>
              </div>

              <div className="max-h-[360px] space-y-3 overflow-y-auto p-4">
                {cart.map((item) => (
                    <div
                      key={item.cartKey}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-[#0f1f4d]">
                            {item.name}
                          </p>

                          <p className="mt-1 text-[10px] font-semibold text-slate-400">
                            Stok: {item.stock} adet
                            {item.isInitial ? " · mevcut kalem" : ""}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.cartKey)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 transition hover:bg-rose-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="mt-3">
                        <SaleLineEditFields
                          key={item.cartKey}
                          unitPrice={item.unitPrice}
                          vatRate={item.vatRate}
                          onUnitPriceChange={(value) =>
                            updateCartItem(item.cartKey, "unitPrice", value)
                          }
                          onVatRateChange={(value) =>
                            updateCartItem(item.cartKey, "vatRate", value)
                          }
                          compact
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 rounded-xl bg-white p-1">
                          <button
                            type="button"
                            onClick={() => decreaseQuantity(item.cartKey)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
                          >
                            <Minus size={14} />
                          </button>

                          <span className="min-w-7 text-center text-[12px] font-black text-[#0f1f4d]">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => increaseQuantity(item.cartKey)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <p className="text-[13px] font-black text-[#0f1f4d]">
                          {formatMoney(calculateLineSubtotal(item))}
                        </p>
                      </div>
                    </div>
                ))}
              </div>

              <div className="border-t border-slate-100 p-4">
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
                  <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
                    {error}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleUpdateQuote}
                  disabled={saving || cart.length === 0}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-amber-500 to-orange-500 text-[13px] font-black text-white shadow-lg shadow-amber-100 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                  {saving ? "Teklif güncelleniyor..." : "Teklifi Güncelle"}
                </button>

                {cart.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[12px] font-bold text-amber-800">
                      <CheckCircle2 size={17} />
                      Güncelleme sırasında stok düşmez.
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-[12px] font-bold text-blue-800">
                      <CheckCircle2 size={17} />
                      Cari bakiye teklif aşamasında güncellenmez.
                    </div>
                  </div>
                ) : null}
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
  color: "amber" | "blue" | "violet";
}) {
  const colorMap = {
    amber: "bg-amber-50 text-amber-600",
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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-black text-[#0f1f4d]">{value}</span>
    </div>
  );
}
