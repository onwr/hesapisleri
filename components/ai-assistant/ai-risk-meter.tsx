"use client";

import { useEffect, useState } from "react";

type AiRiskMeterProps = {
  score: number;
  barClass: string;
  textClass: string;
};

export function AiRiskMeter({ score, barClass, textClass }: AiRiskMeterProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setWidth(score), 120);
    return () => window.clearTimeout(timer);
  }, [score]);

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-bold text-slate-500">Risk skoru</span>
        <span className={`text-[13px] font-black ${textClass}`}>{score}/100</span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={[
            "h-full rounded-full transition-[width] duration-1000 ease-out",
            barClass,
          ].join(" ")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
