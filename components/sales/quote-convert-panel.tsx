"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import {
  ArrowRightLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
} from "lucide-react";
import { CollectionAccountSelect } from "@/components/cash-bank/collection-account-select";
import { WarehouseSelectField } from "@/components/shared/warehouse-select-field";
import { useCollectionAccounts } from "@/hooks/use-collection-accounts";
import { resolveDefaultCollectionAccountId } from "@/lib/collection-account-utils";
import { formatMoney } from "@/lib/format-utils";

type QuoteConvertPanelProps = {
  saleId: string;
  saleNo: string;
  total: number;
  defaultOpen?: boolean;
};

export function QuoteConvertPanel({
  saleId,
  saleNo,
  total,
  defaultOpen = false,
}: QuoteConvertPanelProps) {
  const router = useRouter();
  const { accounts, loading: accountsLoading } = useCollectionAccounts();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [paymentStatus, setPaymentStatus] = useState<
    "UNPAID" | "PAID" | "PARTIAL"
  >("UNPAID");
  const [collectedAmountInput, setCollectedAmountInput] = useState("");
  const [accountId, setAccountId] = useState("");
  const [warehouses, setWarehouses] = useState<
    Array<{ id: string; name: string; code?: string | null; isDefault?: boolean }>
  >([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [warehouseEnabled, setWarehouseEnabled] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (accountsLoading) return;

    setAccountId((current) =>
      current && accounts.some((account) => account.id === current)
        ? current
        : resolveDefaultCollectionAccountId(accounts)
    );
  }, [accounts, accountsLoading]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadWarehouses() {
      try {
        const response = await fetch("/api/stocks/warehouses/options");
        const result = (await response.json()) as {
          success?: boolean;
          data?: {
            warehouses?: Array<{
              id: string;
              name: string;
              code?: string | null;
              isDefault?: boolean;
            }>;
            defaultWarehouseId?: string | null;
          };
        };

        if (!result.success || !result.data) return;

        setWarehouses(result.data.warehouses ?? []);
        setDefaultWarehouseId(result.data.defaultWarehouseId ?? "");
      } catch {
        // ignore
      }
    }

    void loadWarehouses();
  }, [isOpen]);

  const collectedAmount = (() => {
    if (paymentStatus === "PAID") return total;
    if (paymentStatus === "UNPAID") return 0;

    const parsed = Number(collectedAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(total, parsed);
  })();

  async function handleConvert() {
    setError("");

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

    const confirmed = window.confirm(
      `${saleNo} numaralı teklifi satışa dönüştürmek istediğinize emin misiniz? Bu işlem stok düşer ve cari bakiyeyi etkiler.`
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/sales/${saleId}/convert`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
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
          }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
          data?: { id?: string };
        };

        if (!response.ok || !result.success) {
          setError(result.message ?? "Dönüşüm başarısız.");
          return;
        }

        notifyTenantCacheSync();
        router.push(`/sales/${result.data?.id ?? saleId}`);
      } catch {
        setError("Dönüşüm sırasında bir hata oluştu.");
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-green-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:opacity-95"
      >
        <ArrowRightLeft size={20} />
        Satışa Dönüştür
      </button>
    );
  }

  return (
    <section className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">
            Teklifi Satışa Dönüştür
          </h2>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Dönüşüm sonrası yeni satış numarası üretilir, stok düşer ve cari
            bakiye normal satış kurallarına göre güncellenir.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-sm font-bold text-slate-500 hover:text-slate-800"
        >
          Kapat
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4">
        <WarehouseSelectField
          warehouses={warehouses}
          value={selectedWarehouseId}
          onChange={setSelectedWarehouseId}
          disabled={isPending}
          enabled={warehouseEnabled}
          onEnabledChange={(enabled) => {
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
          }}
        />
        <p className="mt-2 text-[11px] font-semibold text-emerald-800">
          {warehouseEnabled && selectedWarehouseId
            ? "Stok düşümü seçili depodan yapılır."
            : "Depo seçilmezse varsayılan depodan düşülür."}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Ödenmedi",
            value: "UNPAID" as const,
            desc: "Borç cariye işlenir",
          },
          {
            label: "Ödendi",
            value: "PAID" as const,
            desc: "Tam tahsilat",
          },
          {
            label: "Kısmi",
            value: "PARTIAL" as const,
            desc: "Parçalı ödeme",
          },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={isPending}
            onClick={() => {
              setPaymentStatus(item.value);

              if (item.value === "PARTIAL" && !collectedAmountInput) {
                setCollectedAmountInput(
                  total > 0 ? Math.max(1, Math.floor(total / 2)).toFixed(2) : ""
                );
              }
            }}
            className={[
              "rounded-2xl border p-3 text-left transition disabled:opacity-60",
              paymentStatus === item.value
                ? "border-emerald-300 bg-white shadow-sm"
                : "border-emerald-100 bg-white/70 hover:bg-white",
            ].join(" ")}
          >
            <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={15} />
            </span>
            <p className="text-[12px] font-black text-slate-950">{item.label}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">
              {item.desc}
            </p>
          </button>
        ))}
      </div>

      {paymentStatus === "PARTIAL" ? (
        <div className="mt-4 rounded-2xl border border-orange-100 bg-white p-4">
          <label className="text-[11px] font-black uppercase tracking-wide text-orange-700">
            Tahsil Edilen Tutar (₺)
          </label>
          <input
            type="number"
            min="0.01"
            max={total > 0 ? total - 0.01 : undefined}
            step="0.01"
            value={collectedAmountInput}
            onChange={(event) => setCollectedAmountInput(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-orange-200 px-4 text-[13px] font-bold text-slate-950 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
          <p className="mt-2 text-[11px] font-semibold text-orange-700">
            Kalan: {formatMoney(Math.max(0, total - collectedAmount))}
          </p>
        </div>
      ) : null}

      {paymentStatus !== "UNPAID" ? (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4">
          <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
            <CreditCard size={14} />
            Tahsilat Hesabı
          </label>
          <div className="mt-2">
            <CollectionAccountSelect
              accounts={accounts}
              loading={accountsLoading}
              value={accountId}
              onChange={setAccountId}
              disabled={isPending || accountsLoading}
              required
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-[12px] font-bold text-slate-950 outline-none focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50"
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleConvert()}
        disabled={
          isPending ||
          (paymentStatus !== "UNPAID" && accounts.length === 0)
        }
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-green-600 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {isPending ? <Loader2 className="animate-spin" size={18} /> : null}
        {isPending ? "Dönüştürülüyor..." : "Satışa Dönüştür"}
      </button>
    </section>
  );
}
