"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import {
  PRODUCT_IMAGE_UPLOAD_FOLDER,
  formatMaxBytesMbLabel,
  uploadImageToCdn,
} from "@/lib/storage/upload-client";
import { usePlatformUploadLimits } from "@/components/platform-runtime/platform-runtime-provider";
import { ProductThumbnail } from "@/components/products/product-thumbnail";

type ProductImageUploadProps = {
  companyId: string;
  value: string;
  onChange: (imageUrl: string) => void;
  error?: string;
};

export function ProductImageUpload({
  companyId,
  value,
  onChange,
  error,
}: ProductImageUploadProps) {
  const { maxImageBytes } = usePlatformUploadLimits();
  const maxImageMbLabel = formatMaxBytesMbLabel(maxImageBytes);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const displayError = error || localError;

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setLocalError("");

      try {
        const url = await uploadImageToCdn(
          file,
          `${PRODUCT_IMAGE_UPLOAD_FOLDER}/${companyId}`,
          maxImageBytes
        );
        onChange(url);
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Görsel yüklenirken hata oluştu."
        );
      } finally {
        setUploading(false);
      }
    },
    [companyId, maxImageBytes, onChange]
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    await uploadFile(file);
    event.target.value = "";
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    await uploadFile(file);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <ImagePlus size={20} strokeWidth={2.4} />
          </div>

          <div>
            <h2 className="text-[16px] font-black text-[#0f1f4d]">
              Ürün Görseli
            </h2>
            <p className="text-[12px] font-medium text-slate-500">
              JPG, PNG veya WebP · Maks. {maxImageMbLabel}MB · Opsiyonel
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {value ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ProductThumbnail
              imageUrl={value}
              alt="Ürün görseli önizleme"
              size={120}
              iconSize={32}
              rounded="2xl"
              className="border border-slate-200 bg-white shadow-sm"
            />

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-black text-[#0f1f4d] transition hover:bg-slate-50">
                {uploading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Upload size={16} />
                )}
                Değiştir
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>

              <button
                type="button"
                onClick={() => onChange("")}
                disabled={uploading}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 text-[13px] font-black text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 size={16} />
                Kaldır
              </button>
            </div>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={[
              "rounded-2xl border-2 border-dashed p-8 text-center transition",
              dragActive
                ? "border-violet-300 bg-violet-50/60"
                : "border-slate-200 bg-slate-50/70 hover:border-violet-200 hover:bg-violet-50/40",
              uploading ? "pointer-events-none opacity-70" : "",
            ].join(" ")}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-violet-500 shadow-sm">
              {uploading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <Upload size={24} strokeWidth={2.2} />
              )}
            </div>

            <p className="mt-4 text-[14px] font-black text-[#0f1f4d]">
              {uploading
                ? "Görsel yükleniyor..."
                : "Görseli sürükleyip bırakın veya dosya seçin"}
            </p>

            <p className="mt-1 text-[12px] font-medium text-slate-500">
              POS ve ürün listesinde görüntülenir
            </p>

            <label className="mt-5 inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-linear-to-r from-violet-600 to-purple-600 px-5 text-[13px] font-black text-white shadow-lg shadow-violet-100 transition hover:opacity-95">
              {uploading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <ImagePlus size={16} />
              )}
              Dosya Seç
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </div>
        )}

        {displayError ? (
          <p className="text-[12px] font-bold text-rose-500">{displayError}</p>
        ) : null}
      </div>
    </section>
  );
}
