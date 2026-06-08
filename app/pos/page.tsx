"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  Loader2,
  Printer,
  ReceiptText,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { PosCartPanel, type PosCartItem } from "@/components/pos/pos-cart-panel";
import { PosCategoryFilter } from "@/components/pos/pos-category-filter";
import { PosProductGrid } from "@/components/pos/pos-product-grid";
import { PosReceipt, printPosReceipt } from "@/components/pos/pos-receipt";
import { WarehouseSelectField } from "@/components/shared/warehouse-select-field";
import {
  buildProductsListUrl,
  getSaleProductStock,
} from "@/lib/sale-warehouse-ui-utils";
import {
  buildPosSaleItemTotal,
  calculatePosTotals,
  getPosPaymentMethodLabel,
  getPosPaymentStatusLabel,
  type PosPaymentMethod,
  type PosPaymentStatus,
} from "@/lib/pos-checkout-utils";
import { formatMoney } from "@/lib/format-utils";

type Customer = {
  id: string;
  name: string;
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
  imageUrl?: string | null;
  barcode?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
};

type Account = {
  id: string;
  name: string;
  type: string;
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

export default function PosPage() {
  const router = useRouter();
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("İşletme");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [warehouseEnabled, setWarehouseEnabled] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");

  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("CASH");
  const [paymentStatus, setPaymentStatus] =
    useState<PosPaymentStatus>("PAID");
  const [collectedAmount, setCollectedAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [successReceipt, setSuccessReceipt] = useState<SuccessReceipt | null>(
    null
  );
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, warehousesRes, accountsRes, meRes] =
          await Promise.all([
            fetch("/api/customers/list"),
            fetch("/api/stocks/warehouses/options"),
            fetch("/api/cash-bank/accounts/list"),
            fetch("/api/auth/me"),
          ]);

        const customersData = await customersRes.json();
        const warehousesData = await warehousesRes.json();
        const accountsData = await accountsRes.json();
        const meData = await meRes.json();

        if (customersData.success) {
          setCustomers(customersData.data);
        }

        if (warehousesData.success) {
          setWarehouses(warehousesData.data.warehouses ?? []);
          setDefaultWarehouseId(warehousesData.data.defaultWarehouseId ?? "");
        }

        const productsRes = await fetch(buildProductsListUrl());
        const productsData = await productsRes.json();

        if (productsData.success) {
          setProducts(productsData.data);
        }

        if (accountsData.success) {
          setAccounts(accountsData.data);
        }

        if (meData.success && meData.data?.company?.name) {
          setCompanyName(meData.data.company.name);
        }

        const params = new URLSearchParams(window.location.search);
        const customerId = params.get("customerId");

        if (customerId) {
          setSelectedCustomerId(customerId);
        }
      } catch {
        setError("POS verileri yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
        barcodeRef.current?.focus();
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    async function reloadProducts() {
      try {
        const productsRes = await fetch(
          warehouseEnabled && selectedWarehouseId
            ? buildProductsListUrl(selectedWarehouseId)
            : buildProductsListUrl()
        );
        const productsData = await productsRes.json();

        if (!productsData.success) return;

        const nextProducts = productsData.data as Product[];
        const useWarehouseStock =
          warehouseEnabled && Boolean(selectedWarehouseId);

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

              return {
                ...item,
                stock,
                quantity: Math.min(item.quantity, stock),
              };
            })
            .filter((item) => item.quantity > 0)
        );
      } catch {
        // ignore
      }
    }

    reloadProducts();
  }, [warehouseEnabled, selectedWarehouseId]);

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

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    let list = products;

    if (selectedCategoryId) {
      list = list.filter(
        (product) =>
          product.categoryId === selectedCategoryId ||
          product.category?.id === selectedCategoryId
      );
    }

    if (!keyword) {
      return list.slice(0, 48);
    }

    return list.filter((product) => {
      return (
        product.name.toLowerCase().includes(keyword) ||
        product.barcode?.toLowerCase().includes(keyword) ||
        product.sku?.toLowerCase().includes(keyword) ||
        product.category?.name?.toLowerCase().includes(keyword)
      );
    });
  }, [products, search, selectedCategoryId]);

  const totals = useMemo(() => {
    return calculatePosTotals(cart, Number(discount) || 0);
  }, [cart, discount]);

  function addToCart(product: Product) {
    setError("");
    setSuccessReceipt(null);

    const useWarehouseStock =
      warehouseEnabled && Boolean(selectedWarehouseId);
    const availableStock = getSaleProductStock(product, useWarehouseStock);

    if (availableStock <= 0) {
      setError(
        useWarehouseStock
          ? `${product.name} seçili depoda stokta yok.`
          : `${product.name} stokta yok.`
      );
      return;
    }

    const price = Number(product.sellPrice);

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);

      if (existing) {
        if (existing.quantity + 1 > availableStock) {
          setError(
            useWarehouseStock
              ? `${product.name} için seçili depoda yeterli stok yok.`
              : `${product.name} için yeterli stok yok.`
          );
          return prev;
        }

        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                stock: availableStock,
              }
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
    setCollectedAmount("");
    setSelectedAccountId("");
    setPaymentStatus("PAID");
    setPaymentMethod("CASH");
    setError("");
    setSuccessReceipt(null);
    barcodeRef.current?.focus();
  }

  function startNewSale() {
    clearCart();
    setSelectedCustomerId("");
    setSuccessReceipt(null);
    barcodeRef.current?.focus();
  }

  function handleBarcodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const code = barcode.trim().toLowerCase();
    if (!code) return;

    const product = products.find(
      (item) =>
        item.barcode?.toLowerCase() === code ||
        item.sku?.toLowerCase() === code
    );

    if (!product) {
      setError("Barkod / stok kodu ile ürün bulunamadı.");
      return;
    }

    addToCart(product);
    setBarcode("");
    barcodeRef.current?.focus();
  }

  async function handleCheckout() {
    setCheckingOut(true);
    setError("");
    setSuccessReceipt(null);

    if (cart.length === 0) {
      setError("Satışı tamamlamak için sepete ürün ekleyin.");
      setCheckingOut(false);
      return;
    }

    if (paymentStatus === "PARTIAL") {
      const collected = Number(collectedAmount) || 0;

      if (collected <= 0) {
        setError("Kısmi ödeme için tahsil edilen tutar girilmelidir.");
        setCheckingOut(false);
        return;
      }

      if (collected >= totals.total) {
        setError("Kısmi ödeme tutarı genel toplamdan küçük olmalıdır.");
        setCheckingOut(false);
        return;
      }
    }

    const checkoutCart = [...cart];
    const checkoutTotals = { ...totals };
    const checkoutPaymentMethod = paymentMethod;
    const checkoutPaymentStatus = paymentStatus;
    const checkoutCollected =
      paymentStatus === "PARTIAL" ? Number(collectedAmount) || 0 : undefined;

    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId || undefined,
          warehouseId:
            warehouseEnabled && selectedWarehouseId
              ? selectedWarehouseId
              : undefined,
          paymentMethod: checkoutPaymentMethod,
          paymentStatus: checkoutPaymentStatus,
          collectedAmount: checkoutCollected,
          discount: checkoutTotals.discount,
          accountId: selectedAccountId || undefined,
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
        setError(data.message || "POS satışı tamamlanamadı.");
        return;
      }

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
        paymentStatus:
          data.data?.paymentStatus || checkoutPaymentStatus,
        collectedAmount: checkoutCollected,
      });

      setCart([]);
      setDiscount("0");
      setNote("");
      setCollectedAmount("");
      setSelectedAccountId("");
      setPaymentStatus("PAID");
      setPaymentMethod("CASH");
      setMobileCartOpen(false);

      const productsRes = await fetch(
        warehouseEnabled && selectedWarehouseId
          ? buildProductsListUrl(selectedWarehouseId)
          : buildProductsListUrl()
      );
      const productsData = await productsRes.json();

      if (productsData.success) {
        setProducts(productsData.data);
      }

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
        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <Loader2 className="animate-spin text-blue-600" size={22} />
          <span className="text-sm font-bold text-slate-700">
            POS ekranı hazırlanıyor...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-4 py-5 lg:px-5 lg:py-6">
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
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
            >
              <ArrowLeft size={18} />
              Panele dön
            </Link>

            <h1 className="text-2xl font-black text-slate-950 lg:text-3xl">
              POS / Hızlı Satış
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Barkod okutun, ürün seçin ve ödemeyi alın.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sales"
              className="hidden h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 md:inline-flex"
            >
              <ReceiptText size={18} />
              Satışlar
            </Link>
            <img
              src="/logo.svg"
              alt="Hesapişleri"
              className="h-10 w-auto object-contain lg:h-12"
            />
          </div>
        </div>

        {successReceipt ? (
          <section className="mb-6 rounded-3xl border border-green-100 bg-green-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-lg font-black text-slate-950">
                    Satış tamamlandı
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    {successReceipt.saleNo} ·{" "}
                    {getPosPaymentMethodLabel(successReceipt.paymentMethod)} ·{" "}
                    {getPosPaymentStatusLabel(successReceipt.paymentStatus)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={printPosReceipt}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white"
                >
                  <Printer size={18} />
                  Fiş Yazdır
                </button>

                <button
                  type="button"
                  onClick={startNewSale}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-green-600 px-5 text-sm font-black text-white"
                >
                  Yeni Satış
                </button>

                {successReceipt.saleId ? (
                  <Link
                    href={`/sales/${successReceipt.saleId}`}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-green-200 bg-white px-5 text-sm font-black text-green-700"
                  >
                    Satış Detayı
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <form
              onSubmit={handleBarcodeSubmit}
              className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Barcode size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-950">Barkod</h2>
                  <p className="text-xs text-slate-500">Enter ile sepete ekle</p>
                </div>
              </div>

              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                autoFocus
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Barkod veya SKU..."
              />
            </form>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <WarehouseSelectField
                warehouses={warehouses}
                value={selectedWarehouseId}
                onChange={setSelectedWarehouseId}
                enabled={warehouseEnabled}
                onEnabledChange={handleWarehouseEnabledChange}
              />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <User size={20} />
                </div>
                <h2 className="text-sm font-black text-slate-950">Müşteri</h2>
              </div>

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Perakende satış</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ürün, barkod, SKU..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>

              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Kategoriler
              </p>
              <PosCategoryFilter
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
              />
            </div>
          </aside>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-black text-slate-950">Ürünler</h2>
              <p className="text-sm text-slate-500">
                {filteredProducts.length} ürün listeleniyor
              </p>
            </div>

            <PosProductGrid
              products={filteredProducts}
              onAdd={addToCart}
              formatMoney={formatMoney}
              showWarehouseStock={
                warehouseEnabled && Boolean(selectedWarehouseId)
              }
            />
          </section>

          <aside className="hidden xl:block">
            <PosCartPanel
              cart={cart}
              subtotal={totals.subtotal}
              vatTotal={totals.vatTotal}
              discount={discount}
              total={totals.total}
              note={note}
              error={error}
              checkingOut={checkingOut}
              paymentMethod={paymentMethod}
              paymentStatus={paymentStatus}
              collectedAmount={collectedAmount}
              selectedAccountId={selectedAccountId}
              accounts={accounts}
              onDiscountChange={setDiscount}
              onNoteChange={setNote}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onRemove={removeFromCart}
              onClear={clearCart}
              onCheckout={handleCheckout}
              onPaymentMethodChange={setPaymentMethod}
              onPaymentStatusChange={setPaymentStatus}
              onCollectedAmountChange={setCollectedAmount}
              onAccountChange={setSelectedAccountId}
              formatMoney={formatMoney}
            />
          </aside>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-40 xl:hidden">
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="flex h-14 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-200"
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
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-hidden rounded-t-[2rem] bg-[#f7f8ff]">
            <PosCartPanel
              cart={cart}
              subtotal={totals.subtotal}
              vatTotal={totals.vatTotal}
              discount={discount}
              total={totals.total}
              note={note}
              error={error}
              checkingOut={checkingOut}
              paymentMethod={paymentMethod}
              paymentStatus={paymentStatus}
              collectedAmount={collectedAmount}
              selectedAccountId={selectedAccountId}
              accounts={accounts}
              onDiscountChange={setDiscount}
              onNoteChange={setNote}
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onRemove={removeFromCart}
              onClear={clearCart}
              onCheckout={handleCheckout}
              onPaymentMethodChange={setPaymentMethod}
              onPaymentStatusChange={setPaymentStatus}
              onCollectedAmountChange={setCollectedAmount}
              onAccountChange={setSelectedAccountId}
              formatMoney={formatMoney}
              mobile
              onCloseMobile={() => setMobileCartOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
