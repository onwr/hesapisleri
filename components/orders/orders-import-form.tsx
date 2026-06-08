"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { ORDER_IMPORT_TEMPLATE } from "@/lib/order-import-service";
import { Button } from "@/components/ui/button";

export function OrdersImportForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  function downloadTemplate() {
    const blob = new Blob([`\uFEFF${ORDER_IMPORT_TEMPLATE}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "siparis-import-sablonu.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!csv.trim()) {
      setError("CSV dosyası seçin veya yapıştırın.");
      return;
    }

    setError(null);
    setMessage(null);
    setImportErrors([]);

    startTransition(async () => {
      const response = await fetch("/api/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message ?? "İçe aktarım başarısız.");
        setImportErrors(result.errors ?? result.data?.errors ?? []);
        return;
      }

      setMessage(result.message);
      if (result.data?.errors?.length) {
        setImportErrors(result.data.errors);
      } else {
        router.push("/orders");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/orders"
          className="text-[12px] font-bold text-blue-600 hover:text-blue-700"
        >
          ← Siparişlere Dön
        </Link>
        <h1 className="mt-2 text-2xl font-black text-[#0f1f4d]">Sipariş Aktar</h1>
        <p className="mt-1 text-[13px] font-semibold text-slate-500">
          CSV şablonunu indirip doldurun, ardından içe aktarın.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <Button
          type="button"
          variant="outline"
          onClick={downloadTemplate}
          className="h-10 rounded-xl font-black"
        >
          <Download size={14} />
          CSV Şablonu İndir
        </Button>

        <label className="mt-4 flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100">
          <Upload size={20} className="text-slate-500" />
          <span className="mt-2 text-[12px] font-bold text-slate-600">
            CSV dosyası seç
          </span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
        </label>

        <textarea
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          rows={8}
          placeholder="CSV içeriğini buraya yapıştırabilirsiniz..."
          className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-[11px] outline-none focus:border-blue-300"
        />

        <Button
          type="button"
          disabled={isPending}
          onClick={handleImport}
          className="mt-4 h-11 rounded-xl bg-violet-600 font-black hover:bg-violet-700"
        >
          {isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              İçe aktarılıyor...
            </>
          ) : (
            <>
              <FileSpreadsheet size={16} />
              Siparişleri İçe Aktar
            </>
          )}
        </Button>

        {message ? (
          <p className="mt-3 text-[12px] font-semibold text-emerald-600">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-[12px] font-semibold text-rose-500">{error}</p>
        ) : null}
        {importErrors.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[11px] font-medium text-rose-500">
            {importErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
