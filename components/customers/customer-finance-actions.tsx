"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { CustomerFinanceModal } from "@/components/customers/customer-finance-modal";
import { useTenantCacheSync } from "@/hooks/use-tenant-cache-sync";

type Props = {
  customerId: string;
  customerName: string;
  currentBalance: number;
};

export function CustomerFinanceActions({
  customerId,
  customerName,
  currentBalance,
}: Props) {
  const [mode, setMode] = useState<"collection" | "payment" | null>(null);
  const [balance, setBalance] = useState(currentBalance);

  useTenantCacheSync(() => {}, { refresh: true });

  useEffect(() => {
    setBalance(currentBalance);
  }, [currentBalance]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("collection")}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[12px] font-black text-white"
        >
          <ArrowDownLeft size={15} />
          Tahsilat Al
        </button>
        <button
          type="button"
          onClick={() => setMode("payment")}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[12px] font-black text-white"
        >
          <ArrowUpRight size={15} />
          Ödeme Yap
        </button>
      </div>

      <CustomerFinanceModal
        customerId={customerId}
        customerName={customerName}
        currentBalance={balance}
        mode={mode}
        onClose={() => setMode(null)}
        onSuccess={(nextBalance) => {
          if (typeof nextBalance === "number" && Number.isFinite(nextBalance)) {
            setBalance(nextBalance);
          }
          setMode(null);
        }}
      />
    </>
  );
}
