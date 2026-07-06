"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Barcode,
  CheckCircle2,
  Loader2,
  Printer,
  ScanBarcode,
  Search,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import {
  PosCartPanel,
  type PosCartItem,
} from "@/components/pos/pos-cart-panel";
import { PosCategoryFilter } from "@/components/pos/pos-category-filter";
import {
  PosPaymentModal,
  createDefaultPosPaymentLine,
  validatePosPaymentLines,
  type PosPaymentLineState,
} from "@/components/pos/pos-payment-modal";
import { PosProductGrid } from "@/components/pos/pos-product-grid";
import { PosQuickActions } from "@/components/pos/pos-quick-actions";
import { PosReceipt, printPosReceipt } from "@/components/pos/pos-receipt";
import { PosStaffHeader } from "@/components/pos/pos-staff-header";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { PosSummaryMetrics } from "@/components/pos/pos-summary-metrics";
import {
  POS_BARCODE_INPUT_CLASS,
  POS_CARD_CLASS,
  POS_GRADIENT_CHECKOUT_CLASS,
  POS_HERO_CLASS,
  POS_INPUT_CLASS,
} from "@/components/pos/pos-ui-tokens";
import { WarehouseSelectField } from "@/components/shared/warehouse-select-field";
import { formatMoney } from "@/lib/format-utils";
import type { PosQuickActionKey } from "@/lib/pos-page-ui-utils";
import {
  adjustCartQuantity,
  filterPosProducts,
  findPosProductByCode,
  getPosProductStock,
  setCartItemQuantity,
  type PosQuickFilter,
} from "@/lib/pos-page-utils";
import {
  validateSaleCartQuantityAgainstStock,
} from "@/lib/sale-cart-quantity-utils";
import { isServiceProductType } from "@/lib/product-type-utils";
import {
  buildPosSaleItemTotal,
  calculatePosTotals,
  getPosPaymentMethodLabel,
  type PosPaymentStatus,
} from "@/lib/pos-checkout-utils";
import { usePosCollectionAccounts } from "@/hooks/use-pos-collection-accounts";
import { getPosCollectionAccountName } from "@/components/pos/pos-collection-account-select";
import {
  buildProductsListUrl,
  getSaleProductStock,
} from "@/lib/sale-warehouse-ui-utils";
import { usePosKeyboardShortcuts } from "@/hooks/use-pos-keyboard-shortcuts";

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
  productType?: "STOCK" | "SERVICE";
  warehouseStock?: number;
  sellPrice: string | number;
  vatRate: number;
  imageUrl?: string | null;
  barcode?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
};

type SuccessReceiptPayment = {
  paymentMethod: string;
  accountName: string;
  amount: number;
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
  paymentStatus: PosPaymentStatus;
  payments: SuccessReceiptPayment[];
};

type PosStats = {
  todaySalesCount: number;
  todaySalesTotal: number;
  cashBalanceTotal: number;
};

export default function PosPage() {
  const { mutate, isSubmitting: checkingOut } = useTenantMutation<{
    id?: string;
    saleNo?: string;
    paymentStatus?: string;
    payments?: Array<{
      paymentMethod: string;
      amount: number | string;
      account?: { name?: string };
    }>;
    warning?: string;
  }>({ refresh: false });
  const barcodeRef = useRef<HTMLInputElement>(null);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);

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
  const [paymentMode, setPaymentMode] = useState<"single" | "split">("single");
  const [paymentLines, setPaymentLines] = useState<PosPaymentLineState[]>([]);
  const [paymentStatus] = useState<PosPaymentStatus>("PAID");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [error, setError] = useState("");
  const [successReceipt, setSuccessReceipt] = useState<SuccessReceipt | null>(
    null
  );
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { accounts, loading: accountsLoading } = usePosCollectionAccounts();

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

        try {
          const settingsRes = await fetch("/api/settings");
          const settingsData = await settingsRes.json();
          if (settingsRes.ok && settingsData.success) {
            setAllowNegativeStock(
              settingsData.data?.settings?.allowNegativeStockSales ?? false
            );
          }
        } catch {
          // Ayarlar yüklenemezse varsayılan: negatif stok kapalı
        }

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
              const nextQuantity =
                product && isServiceProductType(product.productType)
                  ? item.quantity
                  : Math.min(item.quantity, stock);
              return {
                ...item,
                stock,
                productType: product?.productType ?? item.productType,
                quantity: nextQuantity,
              };
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

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  function handleQuickAction(key: PosQuickActionKey) {
    if (key === "barcode") {
      barcodeRef.current?.focus();
      return;
    }

    if (key === "stock") {
      setSelectedCategoryId("");
      setQuickFilter("stock");
      setSearch("");
      return;
    }

    if (key === "service") {
      setSelectedCategoryId("");
      setQuickFilter("service");
      setSearch("");
      return;
    }

    if (key === "discount") {
      if (window.innerWidth < 1280) {
        setMobileCartOpen(true);
      }
      window.setTimeout(() => {
        document.getElementById("pos-discount-input")?.focus();
      }, 120);
      return;
    }

    if (key === "payment") {
      openPaymentModal();
    }
  }

  function addToCart(product: Product) {
    setError("");
    setSuccessReceipt(null);
    const availableStock = getPosProductStock(product, useWarehouseStock);
    const price = Number(product.sellPrice);

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                stock: availableStock,
                productType: product.productType,
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
          productType: product.productType,
        },
      ];
    });
  }

  function clearQuantityError(productId: string) {
    setQuantityErrors((prev) => {
      if (!prev[productId]) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function increaseQuantity(productId: string) {
    setCart((prev) => {
      const item = prev.find((entry) => entry.productId === productId);
      if (!item) return prev;

      const nextQuantity = item.quantity + 1;
      const stockError = validateSaleCartQuantityAgainstStock(
        item,
        nextQuantity,
        { allowNegativeStock }
      );

      if (stockError) {
        setQuantityErrors((current) => ({
          ...current,
          [productId]: stockError,
        }));
        return prev;
      }

      clearQuantityError(productId);
      return adjustCartQuantity(prev, productId, 1);
    });
  }

  function decreaseQuantity(productId: string) {
    clearQuantityError(productId);
    setCart((prev) => adjustCartQuantity(prev, productId, -1));
  }

  function changeQuantity(productId: string, quantity: number) {
    clearQuantityError(productId);
    setCart((prev) => setCartItemQuantity(prev, productId, quantity));
  }

  function handleQuantityError(productId: string, error: string | null) {
    if (!error) {
      clearQuantityError(productId);
      return;
    }

    setQuantityErrors((prev) => ({ ...prev, [productId]: error }));
  }

  function removeFromCart(productId: string) {
    clearQuantityError(productId);
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function updateCartItem(
    productId: string,
    patch: Partial<Pick<PosCartItem, "unitPrice" | "vatRate">>
  ) {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, ...patch } : item
      )
    );
  }

  function clearCart() {
    setCart([]);
    setQuantityErrors({});
    setDiscount("0");
    setNote("");
    setReceivedAmount("");
    setPaymentLines([]);
    setPaymentMode("single");
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

  function openPaymentModal(method?: PosPaymentLineState["paymentMethod"]) {
    if (cart.length === 0) {
      setError("Satışı tamamlamak için sepete ürün ekleyin.");
      return;
    }

    if (Object.keys(quantityErrors).length > 0) {
      setError("Sepette geçersiz miktar bulunuyor. Lütfen düzeltin.");
      return;
    }

    setError("");
    setPaymentMode("single");
    setPaymentLines([
      createDefaultPosPaymentLine(totals.total, method ?? "CASH"),
    ]);
    setReceivedAmount(String(totals.total));
    setPaymentOpen(true);
  }

  const openCashPaymentModal = useCallback(() => {
    openPaymentModal("CASH");
  }, [cart.length, totals.total]);

  const openCardPaymentModal = useCallback(() => {
    openPaymentModal("CARD");
  }, [cart.length, totals.total]);

  async function handleCheckout() {
    setError("");

    if (cart.length === 0) {
      setError("Satışı tamamlamak için sepete ürün ekleyin.");
      return;
    }

    if (Object.keys(quantityErrors).length > 0) {
      setError("Sepette geçersiz miktar bulunuyor. Lütfen düzeltin.");
      return;
    }

    const normalizedLines =
      paymentMode === "single" && paymentLines[0]
        ? [{ ...paymentLines[0], amount: String(totals.total) }]
        : paymentLines;

    const validationError = validatePosPaymentLines({
      lines: normalizedLines,
      total: totals.total,
      accounts,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    const checkoutCart = [...cart];
    const checkoutTotals = { ...totals };
    const checkoutLines = normalizedLines.map((line) => ({
      paymentMethod: line.paymentMethod,
      amount: Number(line.amount),
      accountId: line.accountId,
    }));

    if (!checkoutIdempotencyKeyRef.current) {
      checkoutIdempotencyKeyRef.current = crypto.randomUUID();
    }
    const idempotencyKey = checkoutIdempotencyKeyRef.current;

    const result = await mutate("/api/pos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey,
        customerId: selectedCustomerId || undefined,
        warehouseId: useWarehouseStock ? selectedWarehouseId : undefined,
        paymentStatus: "PAID",
        discount: checkoutTotals.discount,
        note,
        payments: checkoutLines,
        items: checkoutCart.map((item) => ({
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
        setError(result.error || "Satış tamamlanamadı.");
      }
      return;
    }

    const data = result.data;
    const responsePayments = Array.isArray(data?.payments)
      ? data.payments.map((payment) => ({
          paymentMethod: payment.paymentMethod,
          accountName: payment.account?.name ?? "Hesap",
          amount: Number(payment.amount),
        }))
      : checkoutLines.map((line) => ({
          paymentMethod: line.paymentMethod,
          accountName:
            getPosCollectionAccountName(accounts, line.accountId) ?? "Hesap",
          amount: line.amount,
        }));

    setPaymentOpen(false);
    setSuccessReceipt({
      saleNo: data?.saleNo || "Satış tamamlandı",
      saleId: data?.id || "",
      date: new Date().toLocaleString("tr-TR"),
      items: checkoutCart,
      subtotal: checkoutTotals.subtotal,
      vatTotal: checkoutTotals.vatTotal,
      discount: checkoutTotals.discount,
      total: checkoutTotals.total,
      paymentStatus: (data?.paymentStatus as PosPaymentStatus) || "PAID",
      payments: responsePayments,
    });

    if (result.message?.includes("daha önce tamamlanmış")) {
      setError(result.message);
    } else {
      setError("");
    }

    setCart([]);
    checkoutIdempotencyKeyRef.current = null;
    setDiscount("0");
    setNote("");
    setReceivedAmount("");
    setPaymentLines([]);
    setPaymentMode("single");
    setMobileCartOpen(false);

    const productsRes = await fetch(
      useWarehouseStock
        ? buildProductsListUrl(selectedWarehouseId)
        : buildProductsListUrl()
    );
    const productsData = await productsRes.json();
    if (productsData.success) setProducts(productsData.data);

    void loadStats();
    barcodeRef.current?.focus();
  }

  usePosKeyboardShortcuts({
    enabled: !loading && !successReceipt,
    paymentOpen,
    checkingOut,
    cartEmpty: cart.length === 0,
    onCashPayment: openCashPaymentModal,
    onCardPayment: openCardPaymentModal,
    onFocusBarcode: () => barcodeRef.current?.focus(),
    onClearCart: clearCart,
    onCloseModal: () => setPaymentOpen(false),
    onConfirmPayment: () => void handleCheckout(),
  });

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
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-[#f7f8ff] px-4 py-4 sm:px-5 sm:py-5">
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
          paymentStatus={successReceipt.paymentStatus}
          payments={successReceipt.payments}
        />
      ) : null}

      <div className="mx-auto min-w-0 max-w-[1600px]">
        {isPosStaff ? (
          <PosStaffHeader
            companyName={companyName}
            userName={userName}
            employeeName={employeeName}
          />
        ) : null}

        <section className={`${POS_HERO_CLASS} mb-4`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-[0_10px_24px_rgba(79,70,229,0.25)]">
                <ScanBarcode size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#0f1f4d] sm:text-[28px]">
                  Hızlı Satış
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Ürün, hizmet ve barkodlu satış işlemlerinizi hızlıca
                  tamamlayın.
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
                    <Link
                      href="/cash-bank"
                      className="inline-flex h-9 items-center gap-1.5 rounded-2xl border border-orange-200 bg-orange-50 px-3 text-xs font-bold text-orange-700 hover:bg-orange-100"
                    >
                      <Wallet size={14} />
                      Kasa-Banka
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex h-9 items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 text-xs font-bold text-indigo-700">
                Bugün: {stats.todaySalesCount} satış
              </span>
              <span className="inline-flex h-9 items-center rounded-full border border-orange-100 bg-orange-50 px-3 text-xs font-bold text-orange-700">
                Sepet: {cart.length} kalem
              </span>
            </div>
          </div>

          <div className="mt-4">
            <PosQuickActions onAction={handleQuickAction} />
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
                    {successReceipt.saleNo}
                  </p>
                  <div className="mt-2 space-y-1">
                    {successReceipt.payments.map((payment, index) => (
                      <p
                        key={`${payment.paymentMethod}-${payment.accountName}-${index}`}
                        className="text-[12px] font-semibold text-emerald-800"
                      >
                        {getPosPaymentMethodLabel(
                          payment.paymentMethod as PosPaymentLineState["paymentMethod"]
                        )}{" "}
                        · {payment.accountName} · {formatMoney(payment.amount)}
                      </p>
                    ))}
                  </div>
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

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className={`${POS_CARD_CLASS} min-w-0 p-4 sm:p-5`}>
            <PosSummaryMetrics
              todaySalesCount={stats.todaySalesCount}
              todaySalesTotal={stats.todaySalesTotal}
              cartTotal={totals.total}
              cartLineCount={cart.length}
              cartItemCount={cartItemCount}
            />

            <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ürün, hizmet, SKU veya barkod ara"
                  className={`${POS_INPUT_CLASS} pl-11`}
                />
              </div>
              <form onSubmit={handleBarcodeSubmit} className="relative">
                <Barcode
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500"
                />
                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  autoFocus
                  placeholder="Barkod okut..."
                  className={`${POS_BARCODE_INPUT_CLASS} pl-11`}
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
              discountAmount={totals.discount}
              total={totals.total}
              error={error}
              checkingOut={checkingOut}
              onDiscountChange={setDiscount}
              onUnitPriceChange={(productId, value) =>
                updateCartItem(productId, { unitPrice: value })
              }
              onVatRateChange={(productId, value) =>
                updateCartItem(productId, { vatRate: value })
              }
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onQuantityChange={changeQuantity}
              onQuantityRemove={removeFromCart}
              onQuantityError={handleQuantityError}
              quantityErrors={quantityErrors}
              allowNegativeStock={allowNegativeStock}
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
          className={[
            "flex h-14 items-center gap-2 rounded-2xl px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(249,115,22,0.28)]",
            POS_GRADIENT_CHECKOUT_CLASS,
          ].join(" ")}
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
              discountAmount={totals.discount}
              total={totals.total}
              error={error}
              checkingOut={checkingOut}
              onDiscountChange={setDiscount}
              onUnitPriceChange={(productId, value) =>
                updateCartItem(productId, { unitPrice: value })
              }
              onVatRateChange={(productId, value) =>
                updateCartItem(productId, { vatRate: value })
              }
              onIncrease={increaseQuantity}
              onDecrease={decreaseQuantity}
              onQuantityChange={changeQuantity}
              onQuantityRemove={removeFromCart}
              onQuantityError={handleQuantityError}
              quantityErrors={quantityErrors}
              allowNegativeStock={allowNegativeStock}
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
        paymentMode={paymentMode}
        paymentLines={paymentLines}
        accounts={accounts}
        accountsLoading={accountsLoading}
        receivedAmount={receivedAmount}
        note={note}
        selectedCustomerId={selectedCustomerId}
        customers={customers}
        checkingOut={checkingOut}
        error={error}
        hideCreditOptions={isPosStaff}
        onClose={() => setPaymentOpen(false)}
        onConfirm={() => void handleCheckout()}
        onPaymentModeChange={(mode) => {
          setPaymentMode(mode);
          if (mode === "single") {
            setPaymentLines([
              createDefaultPosPaymentLine(
                totals.total,
                paymentLines[0]?.paymentMethod ?? "CASH"
              ),
            ]);
          } else if (paymentLines.length < 2) {
            setPaymentLines([
              createDefaultPosPaymentLine(
                Math.max(0, totals.total - (Number(paymentLines[0]?.amount) || 0)),
                "CARD"
              ),
              paymentLines[0] ?? createDefaultPosPaymentLine(totals.total, "CASH"),
            ]);
          }
        }}
        onPaymentLinesChange={setPaymentLines}
        onReceivedAmountChange={setReceivedAmount}
        onNoteChange={setNote}
        onCustomerChange={setSelectedCustomerId}
        formatMoney={formatMoney}
      />
    </main>
  );
}
