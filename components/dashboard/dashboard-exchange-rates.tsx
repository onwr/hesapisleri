import type { ExchangeRateDisplay } from "@/lib/exchange-rate-utils";
import { formatExchangeRateTime } from "@/lib/exchange-rate-utils";
import { formatMoney } from "@/lib/format-utils";

type DashboardExchangeRatesProps = {
  data: ExchangeRateDisplay | null;
};

export function DashboardExchangeRates({ data }: DashboardExchangeRatesProps) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
          Döviz Kurları
        </h3>
        <p className="mt-3 text-[12px] font-medium text-slate-500">
          Kur bilgisi şu an gösterilemiyor.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
          Döviz Kurları
        </h3>
        {data.isStale ? (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
            Son alınan kur
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-bold text-slate-600">USD</span>
          <span className="text-[13px] font-extrabold text-[#0f1f4d]">
            {formatMoney(data.rates.USD)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-bold text-slate-600">EUR</span>
          <span className="text-[13px] font-extrabold text-[#0f1f4d]">
            {formatMoney(data.rates.EUR)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-bold text-slate-600">GBP</span>
          <span className="text-[13px] font-extrabold text-[#0f1f4d]">
            {formatMoney(data.rates.GBP)}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[10.5px] font-medium text-slate-400">
        Son güncelleme: {formatExchangeRateTime(data.fetchedAt)} · {data.source}
      </p>
    </div>
  );
}
