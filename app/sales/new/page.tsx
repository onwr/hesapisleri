"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CreditCard,
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
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { SaleLineEditFields } from "@/components/sales/sale-line-edit-fields";
import { SaleCartQuantityInput } from "@/components/sales/sale-cart-quantity-input";
import { WarehouseSelectField } from "@/components/shared/warehouse-select-field";
import {
  buildProductsListUrl,
  getSaleProductStock,
} from "@/lib/sale-warehouse-ui-utils";
import { formatMoney } from "@/lib/format-utils";
import { parseTurkishMoneyInput } from "@/lib/money-input-utils";
import {
  calculateLineSubtotal,
  calculateSaleTotals,
  parseSaleDiscountValueInput,
  type SaleDiscountType,
  validateSaleDiscountInput,
  validateSaleLineItems,
} from "@/lib/sale-calculation-utils";
import {
  adjustCartQuantity,
  setCartItemQuantity,
} from "@/lib/pos-page-utils";
import { isServiceProductType } from "@/lib/product-type-utils";
import {
  validateSaleCartQuantityAgainstStock,
} from "@/lib/sale-cart-quantity-utils";
import { useCollectionAccounts } from "@/hooks/use-collection-accounts";

const SALES_HERO_CLASS =
  "rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)] sm:p-6";
const SALES_FORM_SECTION_CLASS =
  "rounded-[22px] border border-slate-200/70 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

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
  sku?: string | null;
  barcode?: string | null;
  stock: number;
  warehouseStock?: number;
  productType?: "STOCK" | "SERVICE";
  sellPrice: string | number;
  vatRate: number;
  category?: {
    name: string;
  } | null;
};

type CartItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  stock: number;
  productType?: "STOCK" | "SERVICE";
};

function getStockClass(stock: number) {
  if (stock <= 0) return "bg-rose-50 text-rose-500";
  if (stock <= 10) return "bg-orange-50 text-orange-500";
  return "bg-emerald-50 text-emerald-600";
}

export default function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCustomerId = searchParams.get("customerId");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [warehouseEnabled, setWarehouseEnabled] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<
    "PAID" | "PARTIAL" | "UNPAID"
  >("PAID");
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [accountId, setAccountId] = useState("");
  const { accounts: collectionAccounts, defaultAccountId, loading: accountsLoading } =
    useCollectionAccounts();
  const [discountType, setDiscountType] = useState<SaleDiscountType>("AMOUNT");
  const [discountValueInput, setDiscountValueInput] = useState("0");
  const [discountNote, setDiscountNote] = useState("");
  const [note, setNote] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const { mutate, isSubmitting } = useTenantMutation<{ id: string }>({
    refresh: false,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!defaultAccountId || accountsLoading) return;

    setAccountId((current) =>
      current && collectionAccounts.some((account) => account.id === current)
        ? current
        : defaultAccountId
    );
  }, [defaultAccountId, collectionAccounts, accountsLoading]);

  useEffect(() => {
    async function loadData() {
      try {
        const [customersRes, warehousesRes] = await Promise.all([
          fetch("/api/customers/list"),
          fetch("/api/stocks/warehouses/options"),
        ]);

        const customersData = await customersRes.json();
        const warehousesData = await warehousesRes.json();

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

        if (warehousesData.success) {
          setWarehouses(warehousesData.data.warehouses ?? []);
          setDefaultWarehouseId(warehousesData.data.defaultWarehouseId ?? "");
        }

        const productsRes = await fetch(buildProductsListUrl());
        const productsData = await productsRes.json();

        if (productsData.success) {
          setProducts(productsData.data);
        }

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
      } catch {
        setError("Veriler yüklenirken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [presetCustomerId]);

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
                productType: product?.productType ?? item.productType,
                quantity:
                  product && isServiceProductType(product.productType)
                    ? item.quantity
                    : Math.min(item.quantity, stock),
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

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return products;

    return products.filter((product) => {
      const haystack = [
        product.name,
        product.sku ?? "",
        product.barcode ?? "",
        product.category?.name ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(query);
    });
  }, [products, productSearch]);

  const discountValue = useMemo(() => {
    const parsed = parseSaleDiscountValueInput(discountValueInput, discountType);
    return parsed ?? 0;
  }, [discountValueInput, discountType]);

  const totals = useMemo(() => {
    return calculateSaleTotals(cart, {
      type: discountType,
      value: discountValue,
    });
  }, [cart, discountType, discountValue]);

  const { subtotal, vatTotal, discount, total } = totals;
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const paidAmount = useMemo(() => {
    if (paymentStatus === "PAID") return total;
    if (paymentStatus === "UNPAID") return 0;

    const parsed = parseTurkishMoneyInput(paidAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(total, parsed);
  }, [paymentStatus, paidAmountInput, total]);

  const collectedAmount = paidAmount;
  const remainingAmount = Math.max(0, total - collectedAmount);

  function addToCart(product: Product) {
    const availableStock = getSaleProductStock(
      product,
      warehouseEnabled && Boolean(selectedWarehouseId)
    );

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
    setError("");
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

  function removeItem(productId: string) {
    clearQuantityError(productId);
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function updateCartItem(
    productId: string,
    patch: Partial<Pick<CartItem, "unitPrice" | "vatRate">>
  ) {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, ...patch } : item
      )
    );
  }

  async function handleSaveSale() {
    setError("");

    if (cart.length === 0) {
      setError("Satış oluşturmak için en az bir ürün ekleyin.");
      return;
    }

    if (Object.keys(quantityErrors).length > 0) {
      setError("Sepette geçersiz miktar bulunuyor. Lütfen düzeltin.");
      return;
    }

    const lineError = validateSaleLineItems(cart);
    if (lineError) {
      setError(lineError);
      return;
    }

    if (paymentStatus === "PARTIAL") {
      if (collectedAmount <= 0) {
        setError("Kısmi ödeme için tahsil edilen tutarı girin.");
        return;
      }

      if (collectedAmount >= total) {
        setError("Tahsil edilen tutar genel toplamdan küçük olmalıdır.");
        return;
      }
    }

    if (paymentStatus !== "UNPAID" && !accountId) {
      setError("Tahsilat hesabı seçin.");
      return;
    }

    const discountError = validateSaleDiscountInput(totals.gross, {
      type: discountType,
      value: discountValue,
    });

    if (discountError) {
      setError(discountError);
      return;
    }

    if (
      discountValueInput.trim() &&
      parseSaleDiscountValueInput(discountValueInput, discountType) === null
    ) {
      setError("İndirim tutarı geçersiz.");
      return;
    }

    const result = await mutate("/api/sales/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: selectedCustomerId || undefined,
        warehouseId:
          warehouseEnabled && selectedWarehouseId
            ? selectedWarehouseId
            : undefined,
        paymentStatus,
        collectedAmount:
          paymentStatus === "PAID"
            ? total
            : paymentStatus === "UNPAID"
              ? 0
              : collectedAmount,
        accountId: paymentStatus === "UNPAID" ? undefined : accountId,
        note,
        discountType,
        discountValue: discountValue,
        discountNote: discountNote.trim() || undefined,
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
        setError(result.error || "Satış oluşturulamadı.");
      }
      return;
    }

    router.push(`/sales/${result.data.id}`);
  }

  if (loading) {
    return (
      <AppLoadingScreen
        preset="sales"
        title="Satış ekranı hazırlanıyor"
        subtitle="Müşteri ve ürünler getiriliyor..."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {isSubmitting ? (
        <AppLoadingScreen
          preset="sales"
          title="Satış kaydediliyor"
          subtitle="Kayıt oluşturuluyor, stok güncelleniyor..."
        />
      ) : null}

      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className={SALES_HERO_CLASS}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/sales"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <h1 className="text-[24px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                  Yeni Satış Oluştur
                </h1>

                <p className="mt-1 text-[13px] font-medium text-slate-500">
                  Müşteri seçin, ürünleri sepete ekleyin ve satışı tamamlayın.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TopInfoCard
                label="Sepetteki Ürün"
                value={`${cart.length} kalem`}
                icon={<ShoppingCart size={17} />}
                color="emerald"
              />

              <TopInfoCard
                label="Toplam Adet"
                value={`${totalQuantity} adet`}
                icon={<Package size={17} />}
                color="blue"
              />

              <TopInfoCard
                label="Genel Toplam"
                value={formatMoney(total)}
                icon={<Wallet size={17} />}
                color="violet"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <div className={`${SALES_FORM_SECTION_CLASS} p-4`}>
              <WarehouseSelectField
                warehouses={warehouses}
                value={selectedWarehouseId}
                onChange={setSelectedWarehouseId}
                enabled={warehouseEnabled}
                onEnabledChange={handleWarehouseEnabledChange}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className={`${SALES_FORM_SECTION_CLASS} p-4`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <User size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Müşteri Bilgisi
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Müşteri seçmeden de hızlı satış yapılabilir.
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
                      "Hızlı satış olarak kayıt oluşturulacak."}
                  </p>
                </div>
              </div>

              <div className={`${SALES_FORM_SECTION_CLASS} p-4`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CreditCard size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Ödeme Bilgisi
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Satışın tahsilat durumunu belirleyin.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: "Ödendi",
                      value: "PAID",
                      desc: "Tam tahsilat",
                      color: "emerald",
                    },
                    {
                      label: "Kısmi",
                      value: "PARTIAL",
                      desc: "Parçalı ödeme",
                      color: "orange",
                    },
                    {
                      label: "Bekliyor",
                      value: "UNPAID",
                      desc: "Tahsilat yok",
                      color: "rose",
                    },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setPaymentStatus(
                          item.value as "PAID" | "PARTIAL" | "UNPAID"
                        );

                        if (item.value === "PARTIAL" && !paidAmountInput) {
                          setPaidAmountInput(
                            total > 0
                              ? Math.max(1, Math.floor(total / 2)).toFixed(2)
                              : ""
                          );
                        }
                      }}
                      className={[
                        "rounded-2xl border p-3 text-left transition",
                        paymentStatus === item.value
                          ? "border-blue-200 bg-blue-50 shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mb-3 flex h-8 w-8 items-center justify-center rounded-xl",
                          item.color === "emerald"
                            ? "bg-emerald-50 text-emerald-600"
                            : item.color === "orange"
                              ? "bg-orange-50 text-orange-500"
                              : "bg-rose-50 text-rose-500",
                        ].join(" ")}
                      >
                        <CheckCircle2 size={15} strokeWidth={2.5} />
                      </span>

                      <p className="text-[12px] font-black text-[#0f1f4d]">
                        {item.label}
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-slate-500">
                        {item.desc}
                      </p>
                    </button>
                  ))}
                </div>

                {paymentStatus === "PARTIAL" ? (
                  <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                    <label className="text-[11px] font-black uppercase tracking-wide text-orange-700">
                      Tahsil Edilen Tutar (₺)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max={total > 0 ? total - 0.01 : undefined}
                      step="0.01"
                      value={paidAmountInput}
                      onChange={(event) =>
                        setPaidAmountInput(event.target.value)
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-orange-200 bg-white px-4 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      placeholder="Örn. 500"
                    />
                    <p className="mt-2 text-[11px] font-semibold text-orange-700">
                      Kalan: {formatMoney(remainingAmount)}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[12px] font-black text-[#0f1f4d]">İndirim</p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        İndirim Türü
                      </label>
                      <select
                        value={discountType}
                        onChange={(event) => {
                          setDiscountType(event.target.value as SaleDiscountType);
                          setDiscountValueInput("0");
                        }}
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                      >
                        <option value="AMOUNT">Tutar</option>
                        <option value="PERCENT">Yüzde</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        {discountType === "PERCENT"
                          ? "İndirim Yüzdesi"
                          : "İndirim Tutarı"}
                      </label>
                      <input
                        value={discountValueInput}
                        onChange={(event) =>
                          setDiscountValueInput(event.target.value)
                        }
                        inputMode="decimal"
                        placeholder={discountType === "PERCENT" ? "Örn. 10" : "0"}
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                      İndirim Notu
                    </label>
                    <input
                      value={discountNote}
                      onChange={(event) => setDiscountNote(event.target.value)}
                      placeholder="Opsiyonel"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-medium text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                </div>

                {paymentStatus !== "UNPAID" ? (
                  <div className="mt-4">
                    <label className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                      Tahsilat Hesabı
                    </label>
                    <div className="mt-2">
                      <CollectionAccountSelect
                        accounts={collectionAccounts}
                        loading={accountsLoading}
                        value={accountId}
                        onChange={setAccountId}
                        required
                        disabled={isSubmitting || accountsLoading}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={`${SALES_FORM_SECTION_CLASS} overflow-hidden`}>
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-[16px] font-black text-[#0f1f4d]">
                    Ürün Seç
                  </h2>

                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    Satışa eklemek istediğiniz ürünleri seçin.
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
                  const displayStock = getSaleProductStock(
                    product,
                    warehouseEnabled && Boolean(selectedWarehouseId)
                  );

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-[0_14px_30px_rgba(37,99,235,0.10)]"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-blue-50 to-violet-50 text-blue-600">
                          <Package size={20} strokeWidth={2.4} />
                        </div>

                        <span
                          className={[
                            "rounded-md px-2 py-1 text-[10px] font-black",
                            getStockClass(displayStock),
                          ].join(" ")}
                        >
                          Stok: {displayStock}
                        </span>
                      </div>

                      <p className="line-clamp-1 text-[13px] font-black text-[#0f1f4d] group-hover:text-blue-600">
                        {product.name}
                      </p>

                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {product.category?.name ?? "Genel"} · KDV %
                        {product.vatRate}
                      </p>

                      {warehouseEnabled && selectedWarehouseId ? (
                        <p className="mt-1 text-[11px] font-bold text-blue-600">
                          Bu depoda: {displayStock} adet
                        </p>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-[16px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                          {formatMoney(Number(product.sellPrice))}
                        </p>

                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition group-hover:scale-105">
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
                      Satış Sepeti
                    </h2>

                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                      Eklenen ürünleri kontrol edin.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <ShoppingCart size={22} strokeWidth={2.4} />
                  </div>
                </div>
              </div>

              <div className="max-h-[360px] space-y-3 overflow-y-auto p-4">
                {cart.map((item) => {
                  const hasStockWarning =
                    !isServiceProductType(item.productType) &&
                    item.quantity > item.stock;

                  return (
                    <div
                      key={item.productId}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-[#0f1f4d]">
                            {item.name}
                          </p>

                          <p className="mt-1 text-[10px] font-semibold text-slate-400">
                            Bu satışa özel fiyat
                          </p>

                          <p className="mt-1 text-[10px] font-semibold text-slate-400">
                            {isServiceProductType(item.productType)
                              ? "Hizmet ürünü"
                              : `Stok: ${item.stock} adet`}
                            {hasStockWarning ? (
                              <span className="ml-1 text-amber-600">
                                · Bu işlem sonrası stok eksiye düşebilir.
                              </span>
                            ) : null}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 transition hover:bg-rose-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="mt-3">
                        <SaleLineEditFields
                          key={item.productId}
                          unitPrice={item.unitPrice}
                          vatRate={item.vatRate}
                          onUnitPriceChange={(value) =>
                            updateCartItem(item.productId, { unitPrice: value })
                          }
                          onVatRateChange={(value) =>
                            updateCartItem(item.productId, { vatRate: value })
                          }
                          compact
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <SaleCartQuantityInput
                          productId={item.productId}
                          productName={item.name}
                          quantity={item.quantity}
                          item={item}
                          allowNegativeStock={allowNegativeStock}
                          disabled={isSubmitting}
                          error={quantityErrors[item.productId] ?? null}
                          onQuantityChange={changeQuantity}
                          onQuantityRemove={removeItem}
                          onQuantityError={handleQuantityError}
                          onIncrease={increaseQuantity}
                          onDecrease={decreaseQuantity}
                        />

                        <p className="text-[13px] font-black text-[#0f1f4d]">
                          {formatMoney(calculateLineSubtotal(item))}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {cart.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <ShoppingCart size={24} />
                    </div>

                    <p className="mt-4 text-[15px] font-black text-[#0f1f4d]">
                      Sepet boş
                    </p>

                    <p className="mt-2 text-[12px] font-medium text-slate-500">
                      Satış oluşturmak için ürün ekleyin.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-100 p-4">
                <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <SummaryLine label="Ara Toplam" value={formatMoney(subtotal)} />
                  {discount > 0 ? (
                    <SummaryLine
                      label="İndirim"
                      value={`-${formatMoney(discount)}`}
                    />
                  ) : null}
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

                  {paymentStatus !== "UNPAID" ? (
                    <>
                      <div className="h-px bg-slate-200" />
                      <SummaryLine
                        label="Tahsil Edilen Tutar"
                        value={formatMoney(collectedAmount)}
                      />
                      {paymentStatus === "PARTIAL" ? (
                        <SummaryLine
                          label="Kalan Tahsilat"
                          value={formatMoney(remainingAmount)}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>

                <div className="mt-4">
                  <label className="text-[12px] font-black text-[#24345f]">
                    Satış Notu
                  </label>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[12px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                    placeholder="Satışla ilgili not ekleyin..."
                  />
                </div>

                {error ? (
                  <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
                    {error}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSaveSale}
                  disabled={isSubmitting || cart.length === 0}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-emerald-500 to-green-600 text-[13px] font-black text-white shadow-lg shadow-emerald-100 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                  {isSubmitting ? "Satış kaydediliyor..." : "Satışı Tamamla"}
                </button>

                {cart.length > 0 ? (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-[12px] font-bold text-emerald-700">
                    <CheckCircle2 size={17} />
                    Satış tamamlandığında stok otomatik düşer.
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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-black text-[#0f1f4d]">{value}</span>
    </div>
  );
}
