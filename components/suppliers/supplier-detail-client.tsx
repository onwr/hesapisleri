"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTenantCacheSync } from "@/hooks/use-tenant-cache-sync";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  FileText,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import {
  formatEmailHref,
  formatPhoneHref,
  formatSupplierMoney,
  getSupplierPrimaryLine,
  getSupplierSecondaryLine,
} from "@/lib/supplier-utils";
import { SUPPLIER_BALANCE_LABELS } from "@/lib/supplier-balance-utils";
import { SupplierLedgerTable } from "@/components/suppliers/supplier-ledger-table";
import { SupplierFinanceModal } from "@/components/suppliers/supplier-finance-modal";
import { SupplierCustomerRoleModal } from "@/components/suppliers/supplier-customer-role-modal";
import type { SupplierLedgerRow } from "@/lib/supplier-ledger-utils";

type DetailTab =
  | "overview"
  | "movements"
  | "expenses"
  | "payments"
  | "products"
  | "contacts"
  | "notes";

type SupplierContact = {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

type SupplierProductRow = {
  id: string;
  supplierSku: string | null;
  supplierBarcode: string | null;
  purchasePrice: number | null;
  currency: string;
  minOrderQuantity: number | null;
  leadTimeDays: number | null;
  isPreferred: boolean;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    buyPrice: number | null;
  };
};

type SupplierDetailRecord = {
  id: string;
  code: string | null;
  name: string;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  mobilePhone: string | null;
  email: string | null;
  website: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  iban: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  category: string | null;
  tags: string[];
  notes: string | null;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  paymentTermDays: number | null;
  isFavorite: boolean;
  isActive: boolean;
  updatedAt: string;
  contacts: SupplierContact[];
  supplierProducts: SupplierProductRow[];
};

type ExpenseRow = {
  id: string;
  title: string;
  amount: number;
  date: string;
  paymentStatus: string;
  status: string;
  href: string;
};

type PaymentRow = {
  id: string;
  title: string;
  amount: number;
  date: string;
  accountName: string;
  expenseTitle: string | null;
  expenseHref: string | null;
};

type ActivityRow = {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
};

type SupplierDetailClientProps = {
  supplier: SupplierDetailRecord;
  summary: {
    currentBalance: number;
    payableAmount: number;
    receivableAmount: number;
    directionLabel: string;
    netStatusLabel: string;
    unpaidTotal: number;
    thisMonthPurchases: number;
    productCount: number;
    lastPayment: string | null;
    lastMovementDate: string | null;
    overduePayable: number;
    totalPurchases: number;
  };
  ledger: SupplierLedgerRow[];
  linkedCustomer: {
    id: string;
    name: string;
    balance: number;
    href: string;
  } | null;
  expenses: ExpenseRow[];
  payments: PaymentRow[];
  activityLogs: ActivityRow[];
  canManage: boolean;
  canPay: boolean;
  canCollect: boolean;
};

const TABS: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "Genel Bakış" },
  { key: "movements", label: "Cari Hareketler" },
  { key: "expenses", label: "Giderler / Alışlar" },
  { key: "payments", label: "Ödemeler" },
  { key: "products", label: "Ürünler" },
  { key: "contacts", label: "İletişim" },
  { key: "notes", label: "Notlar / Belgeler" },
];

const CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]";
const SOFT_CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]";

export function SupplierDetailClient({
  supplier,
  summary,
  ledger,
  linkedCustomer,
  expenses,
  payments,
  activityLogs,
  canManage,
  canPay,
  canCollect,
}: SupplierDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const requestedTab = searchParams.get("tab") as DetailTab | null;
  const initialTab = TABS.some((tab) => tab.key === requestedTab) ? requestedTab! : "overview";
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [financeModal, setFinanceModal] = useState<"payment" | "collection" | "adjustment" | null>(
    null
  );
  const [customerRoleOpen, setCustomerRoleOpen] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [actionPending, setActionPending] = useState(false);

  useTenantCacheSync(() => {}, { refresh: true });

  const phoneHref = formatPhoneHref(supplier.phone ?? supplier.mobilePhone);
  const emailHref = formatEmailHref(supplier.email);

  function refreshPage(message?: string) {
    if (message) {
      setBanner({ tone: "success", text: message });
    }

    notifyTenantCacheSync();
  }

  async function patchSupplier(body: Record<string, unknown>) {
    const response = await fetch(`/api/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      setBanner({
        tone: "error",
        text: data.message || "İşlem tamamlanamadı.",
      });
      return false;
    }

    refreshPage(data.message);
    return true;
  }

  async function handleToggleFavorite() {
    if (!canManage) return;

    setActionPending(true);
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}/favorite`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Favori güncellenemedi.");
      }

      refreshPage(data.message);
    } catch (error) {
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Favori güncellenemedi.",
      });
    } finally {
      setActionPending(false);
    }
  }

  async function handleSyncBalance() {
    if (!canManage) return;

    setActionPending(true);
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}/sync-balance`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Bakiye senkronize edilemedi.");
      }

      refreshPage(data.message ?? "Bakiye güncellendi.");
    } catch (error) {
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Bakiye senkronize edilemedi.",
      });
    } finally {
      setActionPending(false);
    }
  }

  async function handleDelete() {
    if (!canManage) return;

    const confirmed = window.confirm(
      `"${getSupplierPrimaryLine(supplier)}" tedarikçisini kalıcı olarak silmek istediğinize emin misiniz?\n\nGider veya stok hareketi varsa silme engellenir.`
    );

    if (!confirmed) return;

    setActionPending(true);
    setMoreActionsOpen(false);

    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Tedarikçi silinemedi.");
      }

      router.push("/suppliers");
    } catch (error) {
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Tedarikçi silinemedi.",
      });
    } finally {
      setActionPending(false);
    }
  }

  function changeTab(tab: DetailTab) {
    setActiveTab(tab);
    startTransition(() => {
      router.replace(`/suppliers/${supplier.id}?tab=${tab}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-5">
      {banner ? (
        <div
          className={[
            "rounded-lg px-3 py-2 text-[12px] font-bold",
            banner.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700",
          ].join(" ")}
        >
          {banner.text}
        </div>
      ) : null}

      <section className={`${CARD_CLASS} p-4`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/suppliers"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white"
              aria-label="Tedarikçiler listesine dön"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-[-0.03em] text-[#0f1f4d]">
                  {getSupplierPrimaryLine(supplier)}
                </h1>
                {supplier.isFavorite ? (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                    Favori
                  </span>
                ) : null}
                <span
                  className={[
                    "rounded-md px-2 py-0.5 text-[10px] font-black",
                    supplier.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {supplier.isActive ? "Aktif" : "Pasif"}
                </span>
              </div>
              {getSupplierSecondaryLine(supplier) ? (
                <p className="mt-1 text-[12px] text-slate-500">
                  {getSupplierSecondaryLine(supplier)}
                </p>
              ) : null}
              <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold text-slate-500">
                <span>{supplier.code ? `Kod: ${supplier.code}` : "Kod tanımlı değil"}</span>
                <span>{supplier.taxNumber ? `Vergi No: ${supplier.taxNumber}` : "Vergi no yok"}</span>
                <span>{[supplier.city, supplier.district].filter(Boolean).join(" / ") || "Şehir yok"}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {canManage ? (
              <>
                {canPay ? (
                  <button
                    type="button"
                    onClick={() => setFinanceModal("payment")}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white"
                  >
                    <Wallet size={14} />
                    Tedarikçiye Ödeme Yap
                  </button>
                ) : null}
                {canCollect ? (
                  <button
                    type="button"
                    onClick={() => setFinanceModal("collection")}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-4 text-[12px] font-black text-blue-700"
                  >
                    <Wallet size={14} />
                    Tedarikçiden Tahsilat Al
                  </button>
                ) : null}
                <Link
                  href={`/expenses/new?supplierId=${supplier.id}`}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-[12px] font-black text-emerald-700"
                >
                  <Plus size={14} />
                  Gider Ekle
                </Link>
                <button
                  type="button"
                  onClick={() => setFinanceModal("adjustment")}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 text-[12px] font-black"
                >
                  Cari Düzeltme
                </button>
                {!linkedCustomer ? (
                  <button
                    type="button"
                    onClick={() => setCustomerRoleOpen(true)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50 px-4 text-[12px] font-black text-violet-700"
                  >
                    Müşteri Rolü Ekle
                  </button>
                ) : null}
                <Link
                  href={`/suppliers/${supplier.id}/edit`}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 text-[12px] font-black"
                >
                  <Pencil size={14} />
                  Düzenle
                </Link>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreActionsOpen((current) => !current)}
                    className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 px-3 text-[12px] font-black sm:w-10"
                    aria-label="Diğer tedarikçi işlemleri"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {moreActionsOpen ? (
                    <div className="absolute right-0 z-20 mt-2 min-w-[210px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <DetailMenuButton onClick={handleToggleFavorite} icon={Star} label={supplier.isFavorite ? "Favoriden çıkar" : "Favoriye ekle"} />
                      <DetailMenuButton onClick={handleSyncBalance} icon={RefreshCw} label="Bakiye senkronla" />
                      <DetailMenuButton onClick={() => patchSupplier({ isActive: !supplier.isActive })} icon={Truck} label={supplier.isActive ? "Pasif yap" : "Aktif yap"} />
                      <DetailMenuButton onClick={handleDelete} icon={Trash2} label="Sil" />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {[
          {
            label: SUPPLIER_BALANCE_LABELS.PAYABLE,
            value: formatSupplierMoney(summary.payableAmount, supplier.currency),
            icon: CircleDollarSign,
          },
          {
            label: SUPPLIER_BALANCE_LABELS.RECEIVABLE,
            value: formatSupplierMoney(summary.receivableAmount, supplier.currency),
            icon: Wallet,
          },
          {
            label: "Net Durum",
            value: summary.netStatusLabel,
            icon: RefreshCw,
          },
          {
            label: "Vadesi Geçen",
            value: formatSupplierMoney(summary.overduePayable, supplier.currency),
            icon: CalendarDays,
          },
          {
            label: "Toplam Alış",
            value: formatSupplierMoney(summary.totalPurchases, supplier.currency),
            icon: FileText,
          },
          {
            label: "Son Hareket",
            value: summary.lastMovementDate
              ? new Date(summary.lastMovementDate).toLocaleDateString("tr-TR")
              : "—",
            icon: Truck,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={SOFT_CARD_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 truncate text-lg font-black text-[#0f1f4d]">
                    {item.value}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[#24345f]">
                  <Icon size={18} strokeWidth={2.4} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => changeTab(tab.key)}
            className={[
              "rounded-lg px-3 py-1.5 text-[11px] font-extrabold",
              activeTab === tab.key
                ? "bg-[#0f1f4d] text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className={`${CARD_CLASS} p-4`}>
            <h2 className="text-[14px] font-black text-[#0f1f4d]">Son Hareketler</h2>
            <div className="mt-3 space-y-2">
              {activityLogs.slice(0, 6).length === 0 ? (
                <EmptyTab message="Henüz hareket bulunmuyor." />
              ) : (
                activityLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col gap-1 rounded-xl border border-slate-100 px-3 py-2 text-[12px] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-black text-[#0f1f4d]">{log.action}</p>
                      <p className="text-slate-500">{log.message || "Tedarikçi hareketi"}</p>
                    </div>
                    <span className="font-semibold text-slate-500">
                      {new Date(log.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <aside className={`${CARD_CLASS} p-4`}>
            <h2 className="text-[14px] font-black text-[#0f1f4d]">Tedarikçi Bilgileri</h2>
            <dl className="mt-3 grid gap-3 text-[12px]">
              <InfoItem label="Yetkili" value={supplier.contactName || "—"} />
              <InfoItem
                label="Telefon"
                value={supplier.phone || supplier.mobilePhone || "—"}
                href={phoneHref ?? undefined}
              />
              <InfoItem
                label="E-posta"
                value={supplier.email || "—"}
                href={emailHref ?? undefined}
              />
              <InfoItem label="Vergi no" value={supplier.taxNumber || "—"} />
              <InfoItem label="Vergi dairesi" value={supplier.taxOffice || "—"} />
              <InfoItem label="IBAN" value={supplier.iban || "—"} />
              <InfoItem
                label="Adres"
                value={
                  [supplier.address, supplier.district, supplier.city, supplier.country]
                    .filter(Boolean)
                    .join(" / ") || "—"
                }
              />
            </dl>
          </aside>
        </section>
      ) : null}

      {activeTab === "movements" ? (
        <section className={`${CARD_CLASS} p-4`}>
          <h2 className="text-[14px] font-black text-[#0f1f4d]">Cari Hareketler</h2>
          <div className="mt-3">
            <SupplierLedgerTable rows={ledger} currency={supplier.currency} />
          </div>
        </section>
      ) : null}

      {activeTab === "expenses" ? (
        <section className={`${CARD_CLASS} overflow-x-auto`}>
          {expenses.length === 0 ? (
            <EmptyTab message="Bu tedarikçiye bağlı gider kaydı bulunmuyor." />
          ) : (
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-600">
                  <th className="px-3 py-2.5">Başlık</th>
                  <th className="px-3 py-2.5">Tutar</th>
                  <th className="px-3 py-2.5">Tarih</th>
                  <th className="px-3 py-2.5">Ödeme</th>
                  <th className="px-3 py-2.5">Durum</th>
                  <th className="px-3 py-2.5">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-3 py-2.5 font-bold">{expense.title}</td>
                    <td className="px-3 py-2.5 font-black">
                      {formatSupplierMoney(expense.amount, supplier.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {new Date(expense.date).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-3 py-2.5">
                      {expense.paymentStatus === "PAID" ? "Ödendi" : "Ödenmedi"}
                    </td>
                    <td className="px-3 py-2.5">{formatExpenseStatus(expense.status)}</td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={expense.href}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black"
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {activeTab === "payments" ? (
        <section className={`${CARD_CLASS} overflow-x-auto`}>
          {payments.length === 0 ? (
            <EmptyTab message="Bu tedarikçiye ait ödeme kaydı bulunmuyor." />
          ) : (
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-600">
                  <th className="px-3 py-2.5">Başlık</th>
                  <th className="px-3 py-2.5">Tutar</th>
                  <th className="px-3 py-2.5">Tarih</th>
                  <th className="px-3 py-2.5">Hesap</th>
                  <th className="px-3 py-2.5">Gider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-2.5 font-bold">{payment.title}</td>
                    <td className="px-3 py-2.5 font-black">
                      {formatSupplierMoney(payment.amount, supplier.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {new Date(payment.date).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-3 py-2.5">{payment.accountName}</td>
                    <td className="px-3 py-2.5">
                      {payment.expenseHref && payment.expenseTitle ? (
                        <Link
                          href={payment.expenseHref}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {payment.expenseTitle}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {activeTab === "products" ? (
        <section className={`${CARD_CLASS} overflow-x-auto`}>
          {supplier.supplierProducts.length === 0 ? (
            <EmptyTab message="Bu tedarikçiye bağlı ürün kaydı bulunmuyor." />
          ) : (
            <table className="w-full min-w-[860px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black text-slate-600">
                  <th className="px-3 py-2.5">Ürün</th>
                  <th className="px-3 py-2.5">SKU</th>
                  <th className="px-3 py-2.5">Tedarikçi SKU</th>
                  <th className="px-3 py-2.5">Alış fiyatı</th>
                  <th className="px-3 py-2.5">Tercih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplier.supplierProducts.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5 font-bold">{item.product.name}</td>
                    <td className="px-3 py-2.5">{item.product.sku || "—"}</td>
                    <td className="px-3 py-2.5">{item.supplierSku || "—"}</td>
                    <td className="px-3 py-2.5">
                      {item.purchasePrice != null
                        ? formatSupplierMoney(item.purchasePrice, item.currency)
                        : item.product.buyPrice != null
                          ? formatSupplierMoney(item.product.buyPrice, item.currency)
                          : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.isPreferred ? "Evet" : "Hayır"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {activeTab === "contacts" ? (
        <section className={`${CARD_CLASS} p-3`}>
          {supplier.contacts.length === 0 ? (
            <EmptyTab message="Bu tedarikçiye bağlı kişi kaydı bulunmuyor." />
          ) : (
            <div className="space-y-2">
              {supplier.contacts.map((contact) => {
                const contactPhoneHref = formatPhoneHref(contact.phone);
                const contactEmailHref = formatEmailHref(contact.email);

                return (
                  <article
                    key={contact.id}
                    className="rounded-lg border border-slate-100 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#0f1f4d]">{contact.name}</p>
                      {contact.isPrimary ? (
                        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700">
                          Birincil
                        </span>
                      ) : null}
                      {contact.title ? (
                        <span className="text-[11px] text-slate-500">{contact.title}</span>
                      ) : null}
                    </div>
                    <div className="mt-2 grid gap-1 text-[11px] font-semibold text-slate-600 sm:grid-cols-2">
                      <p>
                        Telefon:{" "}
                        {contactPhoneHref ? (
                          <a href={contactPhoneHref} className="text-blue-700 hover:underline">
                            {contact.phone}
                          </a>
                        ) : (
                          contact.phone || "—"
                        )}
                      </p>
                      <p>
                        E-posta:{" "}
                        {contactEmailHref ? (
                          <a href={contactEmailHref} className="text-blue-700 hover:underline">
                            {contact.email}
                          </a>
                        ) : (
                          contact.email || "—"
                        )}
                      </p>
                      {contact.notes ? (
                        <p className="sm:col-span-2">Not: {contact.notes}</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "notes" ? (
        <section className={`${CARD_CLASS} p-4`}>
          <h2 className="text-[14px] font-black text-[#0f1f4d]">Notlar / Belgeler</h2>
          {supplier.notes ? (
            <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[12px] font-semibold text-slate-600">
              {supplier.notes}
            </p>
          ) : (
            <EmptyTab message="Bu tedarikçi için not veya belge bulunmuyor." />
          )}
        </section>
      ) : null}


      {isPending || actionPending ? (
        <p className="text-[11px] font-semibold text-slate-500">Güncelleniyor...</p>
      ) : null}

      <SupplierFinanceModal
        supplierId={supplier.id}
        supplierName={getSupplierPrimaryLine(supplier)}
        currency={supplier.currency}
        payableAmount={summary.payableAmount}
        receivableAmount={summary.receivableAmount}
        canPay={canPay}
        canCollect={canCollect}
        canAdjust={canManage}
        mode={financeModal}
        onClose={() => setFinanceModal(null)}
      />

      {customerRoleOpen ? (
        <SupplierCustomerRoleModal
          supplierId={supplier.id}
          onClose={() => setCustomerRoleOpen(false)}
          onSuccess={(message) => {
            setCustomerRoleOpen(false);
            refreshPage(message);
          }}
        />
      ) : null}
    </div>
  );
}

function InfoItem({
  label,
  value,
  href,
  className,
}: {
  label: string;
  value: string;
  href?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-[#0f1f4d]">
        {href ? (
          <a href={href} className="text-blue-700 hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function DetailMenuButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: typeof Truck;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-[#24345f] hover:bg-slate-50"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Wallet size={20} />
      </div>
      <p className="text-[13px] font-semibold text-slate-500">{message}</p>
    </div>
  );
}

function formatExpenseStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Aktif";
    case "CANCELLED":
      return "İptal";
    default:
      return status;
  }
}
