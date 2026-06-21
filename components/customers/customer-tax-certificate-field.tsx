"use client";

import { useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { uploadTaxCertificateToCdn } from "@/lib/storage/tax-certificate-upload";

export type TaxCertificateFormValue = {
  taxCertificateUrl: string;
  taxCertificateFileName: string;
  taxCertificateMimeType: string;
  taxCertificateSize: number | null;
};

type CustomerTaxCertificateFieldProps = {
  value: TaxCertificateFormValue;
  onChange: (value: TaxCertificateFormValue) => void;
  error?: string;
};

const emptyValue: TaxCertificateFormValue = {
  taxCertificateUrl: "",
  taxCertificateFileName: "",
  taxCertificateMimeType: "",
  taxCertificateSize: null,
};

export function CustomerTaxCertificateField({
  value,
  onChange,
  error,
}: CustomerTaxCertificateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFileSelect(file: File | null) {
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const url = await uploadTaxCertificateToCdn(file);
      onChange({
        taxCertificateUrl: url,
        taxCertificateFileName: file.name,
        taxCertificateMimeType: file.type,
        taxCertificateSize: file.size,
      });
    } catch (uploadErr) {
      setUploadError(
        uploadErr instanceof Error
          ? uploadErr.message
          : "Vergi levhası yüklenemedi."
      );
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function clearCertificate() {
    onChange(emptyValue);
    setUploadError("");
  }

  const hasCertificate = Boolean(value.taxCertificateUrl.trim());

  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        Vergi Levhası
      </label>

      <div className="mt-2 space-y-3">
        {hasCertificate ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <FileText size={18} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-[#0f1f4d]">
                    {value.taxCertificateFileName || "Vergi levhası"}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    {value.taxCertificateMimeType || "Dosya"}
                    {value.taxCertificateSize
                      ? ` · ${formatFileSize(value.taxCertificateSize)}`
                      : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={clearCertificate}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-rose-100 bg-white px-3 text-[11px] font-black text-rose-600 transition hover:bg-rose-50"
              >
                <Trash2 size={14} />
                Kaldır
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={value.taxCertificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-blue-600 px-3 text-[11px] font-black text-white transition hover:opacity-95"
              >
                <ExternalLink size={14} />
                Görüntüle
              </a>

              <a
                href={value.taxCertificateUrl}
                download={value.taxCertificateFileName || undefined}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#24345f] transition hover:bg-slate-50"
              >
                İndir
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) =>
                handleFileSelect(event.target.files?.[0] ?? null)
              }
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-black text-[#24345f] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {uploading ? "Yükleniyor..." : "PDF veya Görsel Yükle"}
            </button>

            <p className="mt-2 text-[11px] font-medium text-slate-500">
              PDF, JPEG, PNG veya WebP · Maks. 5MB
            </p>
          </div>
        )}

        <div>
          <label className="text-[11px] font-bold text-slate-500">
            Vergi Levhası Dosya Bağlantısı
          </label>
          <input
            value={value.taxCertificateUrl}
            onChange={(event) =>
              onChange({
                ...value,
                taxCertificateUrl: event.target.value,
                taxCertificateFileName: event.target.value
                  ? value.taxCertificateFileName
                  : "",
                taxCertificateMimeType: event.target.value
                  ? value.taxCertificateMimeType
                  : "",
                taxCertificateSize: event.target.value
                  ? value.taxCertificateSize
                  : null,
              })
            }
            placeholder="https://..."
            className={[
              "mt-2 h-11 w-full rounded-2xl border bg-white px-4 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:ring-4",
              error || uploadError
                ? "border-rose-300 focus:border-rose-300 focus:ring-rose-50"
                : "border-slate-200 focus:border-blue-200 focus:ring-blue-50",
            ].join(" ")}
          />
        </div>
      </div>

      {uploadError ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{uploadError}</p>
      ) : null}

      {error ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{error}</p>
      ) : null}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createEmptyTaxCertificateValue(): TaxCertificateFormValue {
  return { ...emptyValue };
}

export function mapTaxCertificateFromCustomer(customer: {
  taxCertificateUrl?: string | null;
  taxCertificateFileName?: string | null;
  taxCertificateMimeType?: string | null;
  taxCertificateSize?: number | null;
}): TaxCertificateFormValue {
  return {
    taxCertificateUrl: customer.taxCertificateUrl ?? "",
    taxCertificateFileName: customer.taxCertificateFileName ?? "",
    taxCertificateMimeType: customer.taxCertificateMimeType ?? "",
    taxCertificateSize: customer.taxCertificateSize ?? null,
  };
}
