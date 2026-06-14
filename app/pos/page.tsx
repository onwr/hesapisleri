"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Barcode,
  CheckCircle2,
  Loader2,
  Printer,
  ScanBarcode,
  Search,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/cards/stat-card";
import {
  PosCartPanel,
  type PosCartItem,
} from "@/components/pos/pos-cart-panel";
import { PosCategoryFilter } from "@/components/pos/pos-category-filter";
import { PosPaymentModal } from "@/components/pos/pos-payment-modal";
import { PosProductGrid } from "@/components/pos/pos-product-grid";
import { PosReceipt, printPosReceipt } from "@/components/pos/pos-receipt";
import { PosStaffHeader } from "@/components/pos/pos-staff-header";
import {
  POS_CARD_CLASS,
  POS_HERO_CLASS,
  POS_INPUT_CLASS,
} from "@/components/pos/pos-ui-tokens";
import { WarehouseSelectField } from "@/components/shared/warehouse-select-field";
import { formatMoney } from "@/lib/format-utils";
import {
  filterPosProducts,
  findPosProductByCode,
  getPosProductStock,
  type PosQuickFilter,
} from "@/lib/pos-page-utils";
import {
  buildPosSaleItemTotal,
  calculatePosTotals,
  getPosPaymentMethodLabel,
  type PosPaymentMethod,
  type PosPaymentStatus,
} from "@/lib/pos-checkout-utils";
import {
  buildProductsListUrl,
  getSaleProductStock,
} from "@/lib/sale-warehouse-ui-utils";

type Customer = { id: string; name: string };

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
  imageUrl?: string | null;
  barcode?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
};

type SuccessReceipt = {
  saleNo: string;
  saleId: string;
  date: string;
  items: PosCartItem[];
  subtotal: number;
  vatTotal: number;
  discount: number;
  total: number;
  paymentMethod: PosPaymentMethod;
  paymentStatus: PosPaymentStatus;
  collectedAmount?: number;
};

type PosStats = {
  todaySalesCount: number;
  todaySalesTotal: number;
  cashBalanceTotal: number;
};

export default function PosPage() {
  const router = useRouter();
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("İşletme");
  const [userName, setUserName] = useState("");
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [isPosStaff, setIsPosStaff] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [warehouseEnabled, setWarehouseEnabled] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [stats, setStats] = useState<PosStats>({
    todaySalesCount: 0,
    todaySalesTotal: 0,
    cashBalanceTotal: 0,
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [quickFilter, setQuickFilter] = useState<PosQuickFilter>("all");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");

  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("CASH");
  const [paymentStatus] = useState<PosPaymentStatus>("PAID");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [error, setError] = useState("");
  const [successReceipt, setSuccessReceipt] = useState<SuccessReceipt | null>(
    null
  );
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const useWarehouseStock = warehouseEnabled && Boolean(selectedWarehouseId);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/stats");
      const json = await res.json();
      if (res.ok && json.success) {
        setStats(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, warehousesRes, meRes, statsRes] = await Promise.all(
          [
            fetch("/api/customers/list"),
            fetch("/api/stocks/warehouses/options"),
            fetch("/api/auth/me"),
            fetch("/api/pos/stats"),
          ]
        );

        const customersData = await customersRes.json();
        const warehousesData = await warehousesRes.json();
        const meData = await meRes.json();
        const statsData = await statsRes.json();

        if (customersData.success) setCustomers(customersData.data);
        if (warehousesData.success) {
          setWarehouses(warehousesData.data.warehouses ?? []);
          setDefaultWarehouseId(warehousesData.data.defaultWarehouseId ?? "");
        }

        const productsRes = await fetch(buildProductsListUrl());
        const productsData = await productsRes.json();
        if (productsData.success) setProducts(productsData.data);

        if (meData.success && meData.data) {
          setCompanyName(meData.data.company?.name ?? "İşletme");
          setUserName(meData.data.user?.name ?? "");
          setEmployeeName(meData.data.employeeName ?? null);
          const staff =
            meData.data.membership?.effectiveRole === "POS_STAFF" ||
            meData.data.membership?.role === "POS_STAFF";
          setIsPosStaff(staff);
        }

        if (statsData.success) setStats(statsData.data);

        const params = new URLSearchParams(window.location.search);
        const customerId = params.get("customerId");
        if (customerId) setSelectedCustomerId(customerId);
      } catch {
        setError("POS verileri yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
        barcodeRef.current?.focus();
      }
    }

    void loadData();
  }, []);

  useEffect(() => {
    async function reloadProducts() {
      try {
        const productsRes = await fetch(
          useWarehouseStock
            ? buildProductsListUrl(selectedWarehouseId)
            : buildProductsListUrl()
        );
        const productsData = await productsRes.json();
        if (!productsData.success) return;

        const nextProducts = productsData.data as Product[];
        setProducts(nextProducts);
        setCart((prev) =>
          prev
            .map((item) => {
              const product = nextProducts.find(
                (entry) => entry.id === item.productId
              );
              const stock = product
                ? getSaleProductStock(product, useWarehouseStock)
                : item.stock;
              return { ...item, stock, quantity: Math.min(item.quantity, stock) };
            })
            .filter((item) => item.quantity > 0)
        );
      } catch {
        // ignore
      }
    }

    void reloadProducts();
  }, [useWarehouseStock, selectedWarehouseId]);

  function handleWarehouseEnabledChange(enabled: boolean) {
    setWarehouseEnabled(enabled);
    if (!enabled) {
      setSelectedWarehouseId("");
      return;
    }
    setSelectedWarehouseId(
      defaultWarehouseId ||
        warehouses.find((warehouse) => warehouse.isDefault)?.id ||
        warehouses[0]?.id ||
        ""
    );
  }

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      if (!product.category?.id) continue;
      map.set(product.category.id, product.category.name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      filterPosProducts(products, {
        search,
        categoryId: selectedCategoryId,
        quickFilter: selectedCategoryId ? "all" : quickFilter,
        useWarehouseStock,
      }),
    [products, search, selectedCategoryId, quickFilter, useWarehouseStock]
  );

  const totals = useMemo(
    () => calculatePosTotals(cart, Number(discount) || 0),
    [cart, discount]
  );

  function addToCart(product: Product) {
    setError("");
    setSuccessReceipt(null);
    const availableStock = getPosProductStock(product, useWarehouseStock);

    if (availableStock <= 0) {
      setError(`${product.name} stokta yok.`);
      return;
    }

    const price = Number(product.sellPrice);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > availableStock) {
          setError(`${product.name} için yeterli stok yok.`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, stock: availableStock }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: price,
          vatRate: product.vatRate,
          stock: availableStock,
        },
      ];
    });
  }

  function increaseQuantity(productId: string) {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        if (item.quantity + 1 > item.stock) {
          setError(`${item.name} için yeterli stok yok.`);
          return item;
        }
        return { ...item, quantity: item.quantity + 1 };
      })
    );
  }

  function decreaseQuantity(productId: string) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setDiscount("0");
    setNote("");
    setReceivedAmount("");
    setPaymentMethod("CASH");
    setError("");
    setSuccessReceipt(null);
    barcodeRef.current?.focus();
  }

  function startNewSale() {
    clearCart();
    setSelectedCustomerId("");
    setSuccessReceipt(null);
    void loadStats();
    barcodeRef.current?.focus();
  }

  function handleBarcodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const product = findPosProductByCode(products, barcode);
    if (!product) {
      setError("Barkod veya stok kodu ile ürün bulunamadı.");
      return;
    }
    addToCart(product);
    setBarcode("");
    barcodeRef.current?.focus();
  }

  function openPaymentModal() {
    if (cart.length === 0) {
      setError("Satışı tamamlamak için sepete ürün ekleyin.");
      return;
    }
    setError("");
    setReceivedAmount(String(totals.total));
    setPaymentOpen(true);
  }

  async function handleCheckout() {
    setCheckingOut(true);
    setError("");

    if (cart.length === 0) {
      setError("Satışı tamamlamak için sepete ürün ekleyin.");
      setCheckingOut(false);
      return;
    }

    const checkoutCart = [...cart];
    const checkoutTotals = { ...totals };
    const checkoutPaymentMethod = paymentMethod;

    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId || undefined,
          warehouseId: useWarehouseStock ? selectedWarehouseId : undefined,
          paymentMethod: checkoutPaymentMethod,
          paymentStatus: "PAID",
          discount: checkoutTotals.discount,
          note,
          items: checkoutCart.map((item) => ({
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
        setError(data.message || "Satış tamamlanamadı.");
        return;
      }

      setPaymentOpen(false);
      setSuccessReceipt({
        saleNo: data.data?.saleNo || "Satış tamamlandı",
        saleId: data.data?.id || "",
        date: new Date().toLocaleString("tr-TR"),
        items: checkoutCart,
        subtotal: checkoutTotals.subtotal,
        vatTotal: checkoutTotals.vatTotal,
        discount: checkoutTotals.discount,
        total: checkoutTotals.total,
        paymentMethod: checkoutPaymentMethod,
        paymentStatus: data.data?.paymentStatus || "PAID",
      });

      setCart([]);
      setDiscount("0");
      setNote("");
      setReceivedAmount("");
      setPaymentMethod("CASH");
      setMobileCartOpen(false);

      const productsRes = await fetch(
        useWarehouseStock
          ? buildProductsListUrl(selectedWarehouseId)
          : buildProductsListUrl()
      );
      const productsData = await productsRes.json();
      if (productsData.success) setProducts(productsData.data);

      void loadStats();
      router.refresh();
      barcodeRef.current?.focus();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8ff]">
        <div
          className={`${POS_CARD_CLASS} flex items-center gap-3 px-6 py-5`}
        >
          <Loader2 className="animate-spin text-blue-600" size={22} />
          <span className="text-sm font-bold text-slate-700">
            Hızlı satış ekranı hazırlanıyor...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-4 py-4 sm:px-5 sm:py-5">
      {successReceipt ? (
        <PosReceipt
          companyName={companyName}
          saleNo={successReceipt.saleNo}
          date={successReceipt.date}
          items={successReceipt.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            lineTotal: buildPosSaleItemTotal(item),
          }))}
          subtotal={successReceipt.subtotal}
          vatTotal={successReceipt.vatTotal}
          discount={successReceipt.discount}
          total={successReceipt.total}
          paymentMethod={successReceipt.paymentMethod}
          paymentStatus={successReceipt.paymentStatus}
          collectedAmount={successReceipt.collectedAmount}
        />
      ) : null}

      <div className="mx-auto max-w-[1600px]">
        {isPosStaff ? (
          <PosStaffHeader
            companyName={companyName}
            userName={userName}
            employeeName={employeeName}
          />
        ) : null}

        <section className={`${POS_HERO_CLASS} mb-4`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ScanBarcode size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#0f1f4d] sm:text-[28px]">
                  Hızlı Satış
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Ürünleri seçin, ödemeyi alın ve satışı tamamlayın.
                </p>
                {!isPosStaff ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/dashboard"
                      className="inline-flex h-9 items-center rounded-2xl border border-slate-200/80 px-3 text-xs font-bold text-[#0f1f4d] hover:bg-slate-50"
                    >
                      Panele dön
                    </Link>
                    <Link
                      href="/sales"
                      className="inline-flex h-9 items-center rounded-2xl border border-slate-200/80 px-3 text-xs font-bold text-[#0f1f4d] hover:bg-slate-50"
                    >
                      Satışlar
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                title="Bugünkü Satış"
                value={String(stats.todaySalesCount)}
                subtitle={formatMoney(stats.todaySalesTotal)}
                icon={<TrendingUp size={18} />}
                color="blue"
              />
              <StatCard
                title="Kasadaki Toplam"
                value={formatMoney(stats.cashBalanceTotal)}
                subtitle="Nakit kasa bakiyesi"
                icon={<Wallet size={18} />}
                color="green"
              />
              <StatCard
                title="Satış Yapan"
                value={employeeName ?? userName}
                subtitle={companyName}
                icon={<ScanBarcode size={18} />}
                color="purple"
              />
            </div>
          </div>
        </section>

        {successReceipt ? (
          <section className="mb-4 rounded-[24px] border border-emerald-200/70 bg-emerald-50/50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-[#0f1f4d]">
                    Satış tamamlandı
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    {successReceipt.saleNo} ·{" "}
                    {getPosPaymentMethodLabel(successReceipt.paymentMethod)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={printPosReceipt}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
                >
                  <Printer size={18} />
                  Fiş Yazdır
                </button>
                <button
                  type="button"
                  onClick={startNewSale}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-5 text-sm font-black text-emerald-700"
                >
                  Yeni Satışa Başla
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className={`${POS_CARD_CLASS} p-4 sm:p-5`}>
            <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ürün adı, barkod veya SKU ara..."
                  className={`${POS_INPUT_CLASS} pl-11`}
                />
              </div>
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <Barcode
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  autoFocus
                  placeholder="Barkod okut..."
                  className={`${POS_INPUT_CLASS} pl-11`}
                />
              </form>
            </div>

            <div className="mb-4">
              <PosCategoryFilter
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                quickFilter={quickFilter}
                onSelectCategory={(id) => {
                  setSelectedCategoryId(id);
                  if (id) setQuickFilter("all");
                }}
                onQuickFilterChange={setQuickFilter}
              />
            </div>

            {!isPosStaff ? (
              <div className="mb-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-3">
                <WarehouseSelectField
                  warehouses={warehouses}
                  value={selectedWarehouseId}
                  onChange={setSelectedWarehouseId}
                  enabled={warehouseEnabled}
                  onEnabledChange={handleWarehouseEnabledChange}
                />
              </div>
            ) : null}

            <PosProductGrid
              products={filteredProducts}
              onAdd={addToCart}
              formatMoney={formatMoney}
              showWarehouseStock={useWarehouseStock}
            />
          </section>

          <aside className="hidden xl:block">
            <PosCartPanel
              cart={cart}
              subtotal={totals.subtotal}
              vatTotal={totals.vatTotal}
              discount={discount}
              total={totals.total}
              error={error}
              checkingOut={checkingOut}
              onDiscountChange={setDiscount}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onRemove={removeFromCart}
              onClear={clearCart}
              onOpenPayment={openPaymentModal}
              formatMoney={formatMoney}
            />
          </aside>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-40 xl:hidden">
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="flex h-14 items-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(15,31,77,0.2)]"
        >
          <ShoppingCart size={20} />
          Sepet ({cart.length}) · {formatMoney(totals.total)}
        </button>
      </div>

      {mobileCartOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Sepeti kapat"
            onClick={() => setMobileCartOpen(false)}
            className="absolute inset-0 bg-slate-950/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-hidden rounded-t-[24px] bg-[#f7f8ff]">
            <PosCartPanel
              cart={cart}
              subtotal={totals.subtotal}
              vatTotal={totals.vatTotal}
              discount={discount}
              total={totals.total}
              error={error}
              checkingOut={checkingOut}
              onDiscountChange={setDiscount}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onRemove={removeFromCart}
              onClear={clearCart}
              onOpenPayment={() => {
                setMobileCartOpen(false);
                openPaymentModal();
              }}
              formatMoney={formatMoney}
              mobile
              onCloseMobile={() => setMobileCartOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <PosPaymentModal
        open={paymentOpen}
        total={totals.total}
        paymentMethod={paymentMethod}
        receivedAmount={receivedAmount}
        note={note}
        selectedCustomerId={selectedCustomerId}
        customers={customers}
        checkingOut={checkingOut}
        error={error}
        hideCreditOptions={isPosStaff}
        onClose={() => setPaymentOpen(false)}
        onConfirm={() => void handleCheckout()}
        onPaymentMethodChange={setPaymentMethod}
        onReceivedAmountChange={setReceivedAmount}
        onNoteChange={setNote}
        onCustomerChange={setSelectedCustomerId}
        formatMoney={formatMoney}
      />
    </main>
  );
}
