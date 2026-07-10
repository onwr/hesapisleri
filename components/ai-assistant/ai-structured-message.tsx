"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  LineChart,
  PieChart,
} from "lucide-react";
import {
  parseStructuredResponse,
  type AiResponseBlock,
  type AiStructuredResponse,
} from "@/lib/ai/ai-structured-output";
import {
  sanitizeStructuredAiResponse,
  stripUnsafeAiDisplayText,
} from "@/lib/ai/ai-display-safety";

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Satışlar",
  products: "Ürünler",
  stocks: "Stok",
  "cash-bank": "Kasa-Banka",
  finance: "Finans",
  invoices: "Faturalar",
  customers: "Müşteriler",
  expenses: "Giderler",
  rules: "Kural",
};

function SourceModuleTags({ modules }: { modules: string[] }) {
  if (!modules.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {modules.map((module) => (
        <span
          key={module}
          className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700"
        >
          {MODULE_LABELS[module] || module}
        </span>
      ))}
    </div>
  );
}

function MetricBlock({ block }: { block: Extract<AiResponseBlock, { type: "metric" }> }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {block.label}
      </p>
      <p className="mt-1 text-[14px] font-black text-[#0f1f4d]">{block.value}</p>
      {block.trend ? (
        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{block.trend}</p>
      ) : null}
    </div>
  );
}

function TableBlock({ block }: { block: Extract<AiResponseBlock, { type: "table" }> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      {block.title ? (
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-black text-[#0f1f4d]">
          {block.title}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[11px]">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
              {block.columns.map((col) => (
                <th key={col} className="px-3 py-2">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 font-medium text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WarningBlock({ block }: { block: Extract<AiResponseBlock, { type: "warning" }> }) {
  return (
    <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <p className="text-[12px] font-black text-amber-900">{block.title}</p>
        <p className="mt-1 text-[11px] font-medium leading-5 text-amber-800">
          {block.message}
        </p>
      </div>
    </div>
  );
}

function ActionProposalBlock({
  block,
}: {
  block: Extract<AiResponseBlock, { type: "action_proposal" }>;
}) {
  const inner = (
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
      <p className="text-[12px] font-black text-[#0f1f4d]">{block.title}</p>
      <p className="mt-1 text-[11px] font-medium leading-5 text-slate-600">
        {block.description}
      </p>
      <p className="mt-2 text-[10px] font-bold text-blue-700">
        Yalnızca öneri — otomatik işlem yapılmaz
      </p>
    </div>
  );

  if (block.href) {
    return (
      <Link href={block.href} className="block transition hover:opacity-90">
        {inner}
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-600">
          <ExternalLink size={11} />
          Modüle git
        </span>
      </Link>
    );
  }
  return inner;
}

function ChartSuggestionBlock({
  block,
}: {
  block: Extract<AiResponseBlock, { type: "chart_suggestion" }>;
}) {
  const Icon =
    block.chartType === "pie"
      ? PieChart
      : block.chartType === "bar"
        ? BarChart3
        : LineChart;

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-violet-600" />
        <p className="text-[12px] font-black text-[#0f1f4d]">{block.title}</p>
      </div>
      <p className="mt-1 text-[11px] font-medium leading-5 text-slate-600">
        {block.description}
      </p>
    </div>
  );
}

function StructuredBlocks({ response }: { response: AiStructuredResponse }) {
  return (
    <div className="space-y-3">
      {response.blocks.map((block, index) => {
        if (block.type === "text") {
          return (
            <p key={index} className="whitespace-pre-wrap text-[13px] leading-6">
              {block.content}
            </p>
          );
        }
        if (block.type === "metric") return <MetricBlock key={index} block={block} />;
        if (block.type === "table") return <TableBlock key={index} block={block} />;
        if (block.type === "warning") return <WarningBlock key={index} block={block} />;
        if (block.type === "action_proposal") {
          return <ActionProposalBlock key={index} block={block} />;
        }
        if (block.type === "chart_suggestion") {
          return <ChartSuggestionBlock key={index} block={block} />;
        }
        return null;
      })}
      <SourceModuleTags modules={response.sourceModules} />
    </div>
  );
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function resolveAssistantDisplay(
  content: string,
  structured?: unknown
): { mode: "structured"; data: AiStructuredResponse } | { mode: "text"; content: string } {
  const fromStructured = parseStructuredResponse(structured);
  if (fromStructured) {
    const sanitized = sanitizeStructuredAiResponse(fromStructured);
    if (sanitized) return { mode: "structured", data: sanitized };
  }

  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const fromContent = parseStructuredResponse(safeParseJson(trimmed));
    if (fromContent) {
      const sanitized = sanitizeStructuredAiResponse(fromContent);
      if (sanitized) return { mode: "structured", data: sanitized };
    }
    return {
      mode: "text",
      content:
        "Yanıt güvenli biçimde gösterilemedi. Lütfen sorunuzu yeniden deneyin.",
    };
  }

  return { mode: "text", content: stripUnsafeAiDisplayText(content) };
}

type AiStructuredMessageProps = {
  content: string;
  structured?: unknown;
};

export function AiStructuredMessage({ content, structured }: AiStructuredMessageProps) {
  const display = resolveAssistantDisplay(content, structured);
  if (display.mode === "structured") {
    return <StructuredBlocks response={display.data} />;
  }
  return <p className="whitespace-pre-wrap">{display.content}</p>;
}

export function AiInsightMetaFooter({
  period,
  sourceModules,
  generatedAt,
  responseMode,
}: {
  period?: { from: string; to: string };
  sourceModules?: string[];
  generatedAt?: string;
  responseMode?: string;
}) {
  const periodLabel =
    period?.from && period?.to
      ? `${new Date(period.from).toLocaleDateString("tr-TR")} – ${new Date(period.to).toLocaleDateString("tr-TR")}`
      : null;

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
      {sourceModules?.length ? <SourceModuleTags modules={sourceModules} /> : null}
      <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-400">
        {periodLabel ? <span>Dönem: {periodLabel}</span> : null}
        {generatedAt ? (
          <span>
            Güncellendi: {new Date(generatedAt).toLocaleString("tr-TR")}
          </span>
        ) : null}
        {responseMode === "rules_fallback" ? (
          <span className="text-amber-600">Kural tabanlı özet</span>
        ) : null}
      </div>
    </div>
  );
}
