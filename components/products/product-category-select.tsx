"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Tags } from "lucide-react";
import { DEFAULT_CATEGORY_NAME } from "@/lib/product-form-utils";

type CategoryOption = {
  id: string;
  name: string;
  status: string;
};

type ProductCategorySelectProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function ProductCategorySelect({
  value,
  onChange,
  error,
}: ProductCategorySelectProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [useCustomName, setUseCustomName] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch("/api/products/categories");
        const result = (await response.json()) as {
          success?: boolean;
          data?: {
            categories?: CategoryOption[];
          };
        };

        if (response.ok && result.success && result.data?.categories) {
          setCategories(
            result.data.categories.filter(
              (category) => category.status === "ACTIVE"
            )
          );
        }
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }

    void loadCategories();
  }, []);

  const categoryNames = useMemo(() => {
    const names = categories.map((category) => category.name);
    if (!names.includes(DEFAULT_CATEGORY_NAME)) {
      names.unshift(DEFAULT_CATEGORY_NAME);
    }

    const current = value.trim() || DEFAULT_CATEGORY_NAME;
    if (current && !names.includes(current)) {
      names.push(current);
    }

    return names.sort((a, b) => {
      if (a === DEFAULT_CATEGORY_NAME) return -1;
      if (b === DEFAULT_CATEGORY_NAME) return 1;
      return a.localeCompare(b, "tr-TR");
    });
  }, [categories, value]);

  const selectedValue = value.trim() || DEFAULT_CATEGORY_NAME;

  useEffect(() => {
    if (!loading && selectedValue && !categoryNames.includes(selectedValue)) {
      setUseCustomName(true);
    }
  }, [loading, selectedValue, categoryNames]);

  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">Kategori</label>

      {!useCustomName ? (
        <div className="relative mt-2">
          <Tags
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400"
          />

          <select
            value={selectedValue}
            onChange={(event) =>
              onChange(event.target.value || DEFAULT_CATEGORY_NAME)
            }
            disabled={loading}
            className={[
              "h-12 w-full appearance-none rounded-2xl border bg-white pl-11 pr-10 text-[13px] font-bold text-[#0f1f4d] outline-none transition focus:ring-4",
              error
                ? "border-rose-200 focus:border-rose-300 focus:ring-rose-50"
                : "border-slate-200 focus:border-blue-200 focus:ring-blue-50",
            ].join(" ")}
          >
            {loading ? (
              <option value={DEFAULT_CATEGORY_NAME}>Kategoriler yükleniyor...</option>
            ) : (
              categoryNames.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))
            )}
          </select>

          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      ) : (
        <div className="relative mt-2">
          <Tags
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={selectedValue}
            onChange={(event) =>
              onChange(event.target.value || DEFAULT_CATEGORY_NAME)
            }
            disabled={loading}
            placeholder="Yeni kategori adı yazın"
            className={[
              "h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-[13px] font-bold text-[#0f1f4d] outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:ring-4",
              error
                ? "border-rose-200 focus:border-rose-300 focus:ring-rose-50"
                : "border-slate-200 focus:border-blue-200 focus:ring-blue-50",
            ].join(" ")}
          />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (useCustomName) {
              setUseCustomName(false);
              onChange(
                categoryNames.includes(DEFAULT_CATEGORY_NAME)
                  ? DEFAULT_CATEGORY_NAME
                  : categoryNames[0] ?? DEFAULT_CATEGORY_NAME
              );
              return;
            }

            setUseCustomName(true);
          }}
          className="text-[11px] font-black text-blue-600 hover:underline"
        >
          {useCustomName ? "Listeden seç" : "Yeni kategori yaz"}
        </button>

        {!useCustomName ? (
          <span className="text-[11px] font-medium text-slate-400">
            · Listeden kategori seçin
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{error}</p>
      ) : null}
    </div>
  );
}
