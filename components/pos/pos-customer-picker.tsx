"use client";

import { useMemo, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import { POS_INPUT_CLASS } from "@/components/pos/pos-ui-tokens";

type CustomerOption = {
  id: string;
  name: string;
};

type PosCustomerPickerProps = {
  customers: CustomerOption[];
  selectedCustomerId: string;
  onChange: (customerId: string) => void;
  inputId?: string;
};

export function PosCustomerPicker({
  customers,
  selectedCustomerId,
  onChange,
  inputId = "pos-customer-search",
}: PosCustomerPickerProps) {
  const [query, setQuery] = useState("");

  const selected = customers.find((customer) => customer.id === selectedCustomerId);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return customers.slice(0, 8);
    return customers
      .filter((customer) => customer.name.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [customers, query]);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserRound size={14} className="text-slate-500" />
          <p className="text-[12px] font-black text-[#0f1f4d]">Müşteri / Cari</p>
        </div>
        {selectedCustomerId ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
          >
            <X size={12} />
            Temizle
          </button>
        ) : null}
      </div>

      <p className="mb-2 text-[11px] font-semibold text-slate-500">
        {selected
          ? `Seçili: ${selected.name}`
          : "Seçilmezse perakende müşteri olarak işlenir"}
      </p>

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          id={inputId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Müşteri ara..."
          className={`${POS_INPUT_CLASS} pl-9`}
        />
      </div>

      {query.trim() || !selectedCustomerId ? (
        <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            className={[
              "flex w-full items-center rounded-xl px-3 py-2 text-left text-[12px] font-bold",
              !selectedCustomerId
                ? "bg-slate-800 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100",
            ].join(" ")}
          >
            Perakende Müşteri
          </button>
          {filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => {
                onChange(customer.id);
                setQuery("");
              }}
              className={[
                "flex w-full items-center rounded-xl px-3 py-2 text-left text-[12px] font-bold",
                selectedCustomerId === customer.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              {customer.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
