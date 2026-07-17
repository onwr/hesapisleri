"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Printer, RotateCcw } from "lucide-react";
import { CollectionAccountSelect } from "@/components/cash-bank/collection-account-select";
import { useCollectionAccounts } from "@/hooks/use-collection-accounts";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { formatMoney } from "@/lib/format-utils";
import {
  computeSaleReturnLineAmount,
  getSaleReturnRefundMethodLabel,
  type SaleReturnRefundMethod,
} from "@/lib/sale-return-utils";

export type SaleReturnFormItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId: string | null;
  productType: string | null;
  returnedQuantity: number;
  returnableQuantity: number;
  isService: boolean;
};

type SaleReturnFormProps = {
  saleId: string;
  saleNo: string;
  customerName: string | null;
  paymentStatusLabel: string;
  items: SaleReturnFormItem[];
};

const REASON_OPTIONS = [
  "İade",
  "Değişim için iade",
  "Kusurlu ürün",
  "Yanlış ürün",
  "Diğer",
] as const;

export function SaleReturnForm({
  saleId,
  saleNo,
  customerName,
  paymentStatusLabel,
  items,
}: SaleReturnFormProps) {
  const router = useRouter();
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const { accounts, loading: accountsLoading } = useCollectionAccounts();

  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, 0]))
  );
  const [restock, setRestock] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, !item.isService]))
  );
  const [reason, setReason] = useState<string>(REASON_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [refundMethod, setRefundMethod] =
    useState<SaleReturnRefundMethod>("CASH");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    returnId: string;
    returnNo: string;
    totalReturnAmount: number;
  } | null>(null);

  useEffect(() => {
    if (accountsLoading) return;
    const preferred =
      refundMethod === "CARD"
        ? accounts.find((account) => account.type === "POS")?.id ??
          accounts.find((account) => account.type === "BANK")?.id ??
          accounts.find((account) => account.isDefault)?.id ??
          accounts[0]?.id ??
          ""
        : accounts.find((account) => account.type === "CASH")?.id ??
          accounts.find((account) => account.isDefault)?.id ??
          accounts[0]?.id ??
          "";
    setAccountId((current) =>
      current && accounts.some((account) => account.id === current)
        ? current
        : preferred
    );
  }, [accounts, accountsLoading, refundMethod]);

  const selectedLines = useMemo(() => {
    return items
      .map((item) => {
        const qty = Math.floor(Number(quantities[item.id] ?? 0));
        if (qty <= 0) return null;
        const amount = computeSaleReturnLineAmount({
          quantity: qty,
          soldQuantity: item.quantity,
          lineTotal: item.total,
          unitPrice: item.unitPrice,
        });
        return { item, qty, amount };
      })
      .filter(Boolean) as Array<{
      item: SaleReturnFormItem;
      qty: number;
      amount: number;
    }>;
  }, [items, quantities]);

  const totalReturnAmount = selectedLines.reduce(
    (sum, line) => Math.round((sum + line.amount) * 100) / 100,
    0
  );

  async function handleSubmit() {
    setError(null);

    if (selectedLines.length === 0) {
      setError("En az bir ürün için iade adedi girin.");
      return;
    }

    for (const line of selectedLines) {
      if (line.qty > line.item.returnableQuantity) {
        setError(
          `${line.item.name} için en fazla ${line.item.returnableQuantity} adet iade edilebilir.`
        );
        return;
      }
    }

    if (
      (refundMethod === "CASH" || refundMethod === "CARD") &&
      !accountId
    ) {
      setError("İade hesabı seçin.");
      return;
    }

    if (refundMethod === "CREDIT" && !customerName) {
      setError("Cari düzeltme için satışta müşteri olmalıdır.");
      return;
    }

    const result = await mutate(`/api/sales/${saleId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        note: note.trim() || null,
        refundMethod,
        accountId:
          refundMethod === "CREDIT" ? null : accountId || null,
        lines: selectedLines.map((line) => ({
          saleItemId: line.item.id,
          quantity: line.qty,
          restock: line.item.isService ? false : restock[line.item.id] !== false,
        })),
      }),
    });

    if (result.ok) {
      const data = (result.data ?? {}) as {
        returnId?: string;
        returnNo?: string;
        totalReturnAmount?: number;
      };
      setSuccess({
        returnId: data.returnId ?? "",
        returnNo: data.returnNo ?? "",
        totalReturnAmount: data.totalReturnAmount ?? totalReturnAmount,
      });
      router.refresh();
      return;
    }

    if (result.error !== "duplicate_submit") {
      setError(result.error);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-black text-emerald-800">İade tamamlandı</p>
        <p className="mt-2 text-sm text-emerald-700">
          {success.returnNo} · {formatMoney(success.totalReturnAmount)}
        </p>
        <p className="mt-1 text-xs text-emerald-600">
          Değişim için yeni ürün satışını POS üzerinden oluşturabilirsiniz.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {success.returnId ? (
            <Link
              href={`/sales/${saleId}/returns/${success.returnId}/receipt`}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
            >
              <Printer size={16} />
              İade Fişi
            </Link>
          ) : null}
          <Link
            href={`/sales/${saleId}`}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-[#0f1f4d]"
          >
            Satışa Dön
          </Link>
          <Link
            href="/pos"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 text-sm font-black text-emerald-700"
          >
            Yeni Satış (Değişim)
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-500">Satış</p>
        <p className="text-xl font-black text-[#0f1f4d]">{saleNo}</p>
        <p className="mt-1 text-sm text-slate-600">
          Müşteri: {customerName?.trim() || "Perakende Müşteri"} · Ödeme:{" "}
          {paymentStatusLabel}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-black text-[#0f1f4d]">
          İade edilecek ürünler
        </div>
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_120px_140px]">
              <div>
                <p className="font-bold text-slate-800">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Satılan {item.quantity} · İade edilen {item.returnedQuantity} ·
                  Kalan {item.returnableQuantity}
                  {item.isService ? " · Hizmet (stok yok)" : ""}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {formatMoney(item.unitPrice)} · Satır {formatMoney(item.total)}
                </p>
              </div>
              <label className="text-xs font-bold text-slate-500">
                İade adedi
                <input
                  type="number"
                  min={0}
                  max={item.returnableQuantity}
                  value={quantities[item.id] ?? 0}
                  disabled={item.returnableQuantity <= 0 || isSubmitting}
                  onChange={(event) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [item.id]: Number(event.target.value),
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"
                />
              </label>
              {!item.isService ? (
                <label className="flex items-center gap-2 self-end pb-2 text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={restock[item.id] !== false}
                    disabled={isSubmitting}
                    onChange={(event) =>
                      setRestock((prev) => ({
                        ...prev,
                        [item.id]: event.target.checked,
                      }))
                    }
                  />
                  Stoğa geri al
                </label>
              ) : (
                <div className="self-end pb-2 text-xs font-bold text-slate-400">
                  Stok hareketi yok
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-500">
          İade nedeni
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"
            disabled={isSubmitting}
          >
            {REASON_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold text-slate-500">
          İade yöntemi
          <select
            value={refundMethod}
            onChange={(event) =>
              setRefundMethod(event.target.value as SaleReturnRefundMethod)
            }
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"
            disabled={isSubmitting}
          >
            <option value="CASH">{getSaleReturnRefundMethodLabel("CASH")}</option>
            <option value="CARD">{getSaleReturnRefundMethodLabel("CARD")}</option>
            <option value="CREDIT">
              {getSaleReturnRefundMethodLabel("CREDIT")}
            </option>
          </select>
        </label>

        {refundMethod !== "CREDIT" ? (
          <div className="md:col-span-2">
            <p className="mb-1 text-xs font-bold text-slate-500">İade hesabı</p>
            <CollectionAccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              disabled={accountsLoading || isSubmitting}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold"
            />
          </div>
        ) : null}

        <label className="text-xs font-bold text-slate-500 md:col-span-2">
          Not
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Toplam iade
          </p>
          <p className="text-2xl font-black text-[#0f1f4d]">
            {formatMoney(totalReturnAmount)}
          </p>
        </div>
        <button
          type="button"
          data-testid="sale-return-submit"
          onClick={handleSubmit}
          disabled={isSubmitting || totalReturnAmount <= 0}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 text-sm font-black text-white disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <RotateCcw size={16} />
          )}
          İadeyi Onayla
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
