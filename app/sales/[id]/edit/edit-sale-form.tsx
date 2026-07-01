"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
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
import { CollectionAccountSelect } from "@/components/cash-bank/collection-account-select";
import { SaleLineEditFields } from "@/components/sales/sale-line-edit-fields";
import { WarehouseSelectField } from "@/components/shared/warehouse-select-field";
import { useCollectionAccounts } from "@/hooks/use-collection-accounts";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { formatMoney } from "@/lib/format-utils";
import { parseTurkishMoneyInput } from "@/lib/money-input-utils";
import {
  calculateLineSubtotal,
  calculateSaleTotals,
  validateSaleDiscountInput,
  validateSaleLineItems,
} from "@/lib/sale-calculation-utils";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
};

type WarehouseOption = {
  id: string;
  name: string;
  code?: string | null;
  isDefault?: boolean;
};

type Product = {
  id: string;
  name: string;
  stock: number;
  warehouseStock?: number;
  sellPrice: string | number;
  vatRate: number;
  category?: { name: string } | null;
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
};

type EditSaleFormProps = {
  saleId: string;
  saleNo: string;
  revisionNumber: number;
  initialCustomerId: string;
  initialNote: string;
  initialSaleDate: string;
  initialWarehouseId: string;
  initialPaymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  initialPaidAmount: number;
  initialDiscountValue: number;
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
  }));
}

export function EditSaleForm({
  saleId,
  saleNo,
  revisionNumber,
  initialCustomerId,
  initialNote,
  initialSaleDate,
  initialWarehouseId,
  initialPaymentStatus,
  initialPaidAmount,
  initialDiscountValue,
  initialItems,
}: EditSaleFormProps) {
  const router = useRouter();
  const {
    accounts: collectionAccounts,
    defaultAccountId,
    loading: accountsLoading,
  } = useCollectionAccounts();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [warehouseEnabled, setWarehouseEnabled] = useState(Boolean(initialWarehouseId));
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId);

  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId);
  const [saleDate, setSaleDate] = useState(initialSaleDate);
  const [note, setNote] = useState(initialNote);
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [paidAmountInput, setPaidAmountInput] = useState(
    initialPaidAmount > 0 ? String(initialPaidAmount) : ""
  );
  const [accountId, setAccountId] = useState("");
  const [discountValueInput, setDiscountValueInput] = useState(
    String(initialDiscountValue || 0)
  );

  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => buildInitialCart(initialItems));
  const [loading, setLoading] = useState(true);
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultAccountId) {
      setAccountId(defaultAccountId);
    }
  }, [defaultAccountId]);

  useEffect(() => {
    async function loadData() {
      try {
        const productUrl = selectedWarehouseId
          ? `/api/products/list?warehouseId=${encodeURIComponent(selectedWarehouseId)}`
          : "/api/products/list";
        const [customersRes, productsRes, warehousesRes] = await Promise.all([
          fetch("/api/customers/list"),
          fetch(productUrl),
          fetch("/api/stocks/warehouses/options"),
        ]);

        const customersData = await customersRes.json();
        const productsData = await productsRes.json();
        const warehousesData = await warehousesRes.json();

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
              const effectiveStock = product.warehouseStock ?? product.stock;
              return { ...item, stock: effectiveStock };
            })
          );
        }

        if (warehousesData.success) {
          setWarehouses(warehousesData.data.warehouses ?? []);
          const defaultId = warehousesData.data.defaultWarehouseId ?? "";
          if (!selectedWarehouseId && defaultId) {
            setSelectedWarehouseId(defaultId);
          }
        }
      } catch {
        setError("Veriler yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedWarehouseId]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return products;
    return products.filter((product) =>
      product.name.toLocaleLowerCase("tr-TR").includes(query)
    );
  }, [products, productSearch]);

  const discountValue = Number(discountValueInput) || 0;

  const totals = useMemo(
    () =>
      calculateSaleTotals(cart, {
        type: "AMOUNT",
        value: discountValue,
      }),
    [cart, discountValue]
  );

  const { subtotal, vatTotal, discount, total } = totals;
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const paidAmount = useMemo(() => {
    if (paymentStatus === "PAID") return total;
    if (paymentStatus === "UNPAID") return 0;
    const parsed = parseTurkishMoneyInput(paidAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(total, parsed);
  }, [paymentStatus, paidAmountInput, total]);

  function addToCart(product: Product) {
    const price = Number(product.sellPrice);
    setError("");
    setCart((prev) => {
      const current = prev.find((item) => item.productId === product.id);
      if (current) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
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
          stock: product.warehouseStock ?? product.stock,
        },
      ];
    });
  }

  function increaseQuantity(cartKey: string) {
    setCart((prev) =>
      prev.map((entry) =>
        entry.cartKey === cartKey
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry
      )
    );
  }

  function decreaseQuantity(cartKey: string) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.cartKey === cartKey
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(cartKey: string) {
    setCart((prev) => prev.filter((item) => item.cartKey !== cartKey));
  }

  async function handleUpdateSale() {
    setError("");

    if (cart.length === 0) {
      setError("Satış güncellemek için en az bir ürün ekleyin.");
      return;
    }

    const lineError = validateSaleLineItems(cart);
    if (lineError) {
      setError(lineError);
      return;
    }

    if (paymentStatus === "PARTIAL") {
      if (paidAmount <= 0) {
        setError("Kısmi ödeme için tahsil edilen tutarı girin.");
        return;
      }
      if (paidAmount >= total) {
        setError("Tahsil edilen tutar genel toplamdan küçük olmalıdır.");
        return;
      }
    }

    if (paymentStatus !== "UNPAID" && !accountId) {
      setError("Tahsilat hesabı seçin.");
      return;
    }

    const discountError = validateSaleDiscountInput(totals.gross, {
      type: "AMOUNT",
      value: discountValue,
    });
    if (discountError) {
      setError(discountError);
      return;
    }

    const result = await mutate(`/api/sales/${saleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revisionNumber,
        customerId: selectedCustomerId || null,
        saleDate,
        note,
        warehouseId:
          warehouseEnabled && selectedWarehouseId
            ? selectedWarehouseId
            : null,
        paymentStatus,
        collectedAmount:
          paymentStatus === "PAID"
            ? total
            : paymentStatus === "UNPAID"
              ? 0
              : paidAmount,
        accountId: paymentStatus === "UNPAID" ? undefined : accountId,
        discountType: "AMOUNT",
        discountValue,
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        })),
      }),
    });

    if (!result.ok) {
      if (result.error !== "duplicate_submit") {
        setError(result.error || "Satış güncellenemedi.");
      }
      return;
    }

    router.push(`/sales/${saleId}`);
  }

  if (loading) {
    return (
      <AppLoadingScreen
        preset="sales"
        title="Satış düzenleme hazırlanıyor"
        subtitle="Müşteri ve ürünler getiriliyor..."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {isSubmitting ? (
        <AppLoadingScreen
          preset="sales"
          title="Satış güncelleniyor"
          subtitle="Stok ve finans düzeltmeleri uygulanıyor..."
        />
      ) : null}

      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50 to-indigo-50 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href={`/sales/${saleId}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d]"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>
              <div>
                <h1 className="text-[24px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                  Satış Düzenle
                </h1>
                <p className="mt-1 text-[13px] font-medium text-slate-600">
                  {saleNo} numaralı satışı güncelleyin. Stok ve finans farkları
                  otomatik düzeltilir.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard label="Kalem" value={`${cart.length} ürün`} icon={<FileText size={17} />} />
              <InfoCard label="Adet" value={`${totalQuantity} adet`} icon={<Package size={17} />} />
              <InfoCard label="Toplam" value={formatMoney(total)} icon={<Wallet size={17} />} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="Müşteri" icon={<User size={20} />} description="Satışın bağlı olduğu müşteri">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold"
                >
                  <option value="">Müşteri seçmeden devam et</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <p className="mt-3 text-[12px] font-medium text-slate-500">
                  {selectedCustomer?.name || "Müşteri seçilmedi"}
                </p>
              </Panel>

              <Panel title="Satış Tarihi" icon={<CalendarDays size={20} />} description="Raporlarda kullanılacak tarih">
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold"
                />
              </Panel>
            </div>

            <Panel title="Not" icon={<FileText size={20} />} description="Satışa ilişkin açıklama">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[100px] w-full rounded-xl border border-slate-200 px-3 py-2 text-[12px]"
                placeholder="Satış notu..."
              />
            </Panel>

            <WarehouseSelectField
              warehouses={warehouses}
              value={selectedWarehouseId}
              onChange={setSelectedWarehouseId}
              enabled={warehouseEnabled}
              onEnabledChange={setWarehouseEnabled}
            />

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">Ürün Seç</h2>
                  <p className="text-[12px] text-slate-500">Kalemleri güncelleyin veya yeni ürün ekleyin.</p>
                </div>
                <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 lg:max-w-sm">
                  <Search size={16} className="text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ürün ara..."
                    className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
                  />
                </div>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-100 hover:bg-blue-50/40"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Package size={18} />
                      </div>
                      <span className={`rounded-md px-2 py-1 text-[10px] font-black ${getStockClass(product.warehouseStock ?? product.stock)}`}>
                        Stok: {product.warehouseStock ?? product.stock}
                      </span>
                    </div>
                    <p className="text-[13px] font-black text-[#0f1f4d]">{product.name}</p>
                    <p className="mt-2 text-[15px] font-black">{formatMoney(Number(product.sellPrice))}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside>
            <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 p-4">
                <h2 className="text-[17px] font-black text-[#0f1f4d]">Satış Özeti</h2>
              </div>

              <div className="max-h-[320px] space-y-3 overflow-y-auto p-4">
                {cart.map((item) => (
                  <div key={item.cartKey} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-black text-[#0f1f4d]">{item.name}</p>
                        <SaleLineEditFields
                          unitPrice={item.unitPrice}
                          vatRate={item.vatRate}
                          onUnitPriceChange={(value) =>
                            setCart((prev) =>
                              prev.map((entry) =>
                                entry.cartKey === item.cartKey
                                  ? { ...entry, unitPrice: value }
                                  : entry
                              )
                            )
                          }
                          onVatRateChange={(value) =>
                            setCart((prev) =>
                              prev.map((entry) =>
                                entry.cartKey === item.cartKey
                                  ? { ...entry, vatRate: value }
                                  : entry
                              )
                            )
                          }
                        />
                      </div>
                      <button type="button" onClick={() => removeItem(item.cartKey)} className="text-rose-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => decreaseQuantity(item.cartKey)} className="flex h-7 w-7 items-center justify-center rounded-lg border bg-white">
                          <Minus size={14} />
                        </button>
                        <span className="text-[12px] font-black">{item.quantity}</span>
                        <button type="button" onClick={() => increaseQuantity(item.cartKey)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 text-white">
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="text-[13px] font-black">{formatMoney(calculateLineSubtotal(item))}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 border-t border-slate-100 p-4">
                <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-[12px]">
                  <Row label="Ara Toplam" value={formatMoney(subtotal)} />
                  <Row label="KDV" value={formatMoney(vatTotal)} />
                  <div className="flex items-center justify-between gap-2">
                    <span>İndirim (₺)</span>
                    <input
                      value={discountValueInput}
                      onChange={(e) => setDiscountValueInput(e.target.value)}
                      className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-right text-[12px] font-bold"
                    />
                  </div>
                  <Row label="İndirim" value={formatMoney(discount)} />
                  <div className="h-px bg-slate-200" />
                  <Row label="Genel Toplam" value={formatMoney(total)} bold />
                </div>

                <Panel title="Ödeme" icon={<CreditCard size={18} />} description="Tahsilat durumu">
                  <select
                    value={paymentStatus}
                    onChange={(e) =>
                      setPaymentStatus(e.target.value as "PAID" | "PARTIAL" | "UNPAID")
                    }
                    className="mb-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px] font-semibold"
                  >
                    <option value="PAID">Tam Ödendi</option>
                    <option value="PARTIAL">Kısmi Ödendi</option>
                    <option value="UNPAID">Ödenmedi</option>
                  </select>

                  {paymentStatus === "PARTIAL" ? (
                    <input
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      placeholder="Tahsil edilen tutar"
                      className="mb-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-[12px]"
                    />
                  ) : null}

                  {paymentStatus !== "UNPAID" ? (
                    <CollectionAccountSelect
                      accounts={collectionAccounts}
                      loading={accountsLoading}
                      value={accountId}
                      onChange={setAccountId}
                      disabled={isSubmitting || accountsLoading}
                      required
                    />
                  ) : null}
                </Panel>

                {error ? (
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
                    {error}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleUpdateSale()}
                  disabled={isSubmitting || cart.length === 0}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-blue-600 to-violet-600 text-[13px] font-black text-white disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
                  {isSubmitting ? "Satış güncelleniyor..." : "Satışı Güncelle"}
                </button>

                <div className="space-y-2">
                  <Notice text="Stok farkları otomatik düzeltilir." />
                  <Notice text="Tahsilat değişiklikleri kasa/banka hareketlerine yansır." />
                  <Notice text="Cari bakiye yeni toplama göre güncellenir." />
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: ReactNode;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div>
          <h2 className="text-[15px] font-black text-[#0f1f4d]">{title}</h2>
          <p className="text-[11px] text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
      <div className="flex items-center gap-2 text-blue-600">{icon}</div>
      <p className="mt-2 text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="text-[14px] font-black text-[#0f1f4d]">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={bold ? "font-black text-[#0f1f4d]" : "text-slate-500"}>{label}</span>
      <span className={bold ? "font-black text-[#0f1f4d]" : "font-bold text-[#0f1f4d]"}>{value}</span>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-800">
      <CheckCircle2 size={15} />
      {text}
    </div>
  );
}
