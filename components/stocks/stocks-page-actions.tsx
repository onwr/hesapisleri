"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Plus,
  RefreshCcw,
  Truck,
} from "lucide-react";
import {
  StockMovementModal,
  type StockFormProduct,
  type StockFormWarehouse,
} from "@/components/stocks/stock-movement-modal";
import { WarehouseTransferModal } from "@/components/stocks/warehouse-transfer-modal";
import type { StockActionCard } from "@/lib/stocks-page-utils";
import type { StockMovementRequestType } from "@/lib/stock-movement-utils";

const actionIconMap = {
  in: ArrowDownLeft,
  out: ArrowUpRight,
  count: RefreshCcw,
  transfer: Truck,
  plus: Plus,
};

type StocksPageActionsProps = {
  actionCards: StockActionCard[];
  products: StockFormProduct[];
  warehouses: StockFormWarehouse[];
};

export function StocksPageActions({
  actionCards,
  products,
  warehouses,
}: StocksPageActionsProps) {
  const [movementType, setMovementType] =
    useState<StockMovementRequestType | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {actionCards.map((card) => {
          const Icon = actionIconMap[card.iconKey];

          const content = (
            <div
              className={[
                "group flex h-[86px] w-full items-center justify-between rounded-2xl bg-linear-to-br p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
                card.gradient,
              ].join(" ")}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                  <Icon size={22} strokeWidth={2.4} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[15px] font-black leading-tight">
                    {card.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-medium text-white/85">
                    {card.description}
                  </p>
                </div>
              </div>

              <ArrowRight
                size={18}
                strokeWidth={3}
                className="shrink-0 opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
              />
            </div>
          );

          if (card.href) {
            return (
              <Link key={card.title} href={card.href}>
                {content}
              </Link>
            );
          }

          const handleClick = () => {
            if (card.action === "movement-in") setMovementType("IN");
            if (card.action === "movement-out") setMovementType("OUT");
            if (card.action === "movement-count") setMovementType("COUNT");
            if (card.action === "transfer") setTransferOpen(true);
          };

          return (
            <button
              key={card.title}
              type="button"
              onClick={handleClick}
              className="text-left"
            >
              {content}
            </button>
          );
        })}
      </div>

      {movementType ? (
        <StockMovementModal
          open
          onClose={() => setMovementType(null)}
          movementType={movementType}
          products={products}
          warehouses={warehouses}
        />
      ) : null}

      <WarehouseTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        products={products}
        warehouses={warehouses}
      />
    </>
  );
}
