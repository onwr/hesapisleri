import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { PRODUCT_EMPTY_STATE_CLASS } from "@/components/products/product-ui-tokens";

type ProductEmptyStateProps = {
  hasFilters?: boolean;
};

export function ProductEmptyState({ hasFilters = false }: ProductEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className={PRODUCT_EMPTY_STATE_CLASS}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Package size={26} />
        </div>
        <p className="mt-4 text-lg font-extrabold text-[#0f1f4d]">
          Bu filtrede ürün bulunamadı
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Arama veya filtre kriterlerinizi değiştirerek tekrar deneyebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className={PRODUCT_EMPTY_STATE_CLASS}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Package size={26} />
      </div>
      <p className="mt-4 text-lg font-extrabold text-[#0f1f4d]">
        Henüz ürün eklenmedi.
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        İlk ürününüzü ekleyerek stok ve satış takibine başlayın.
      </p>
      <Link
        href="/products/new?returnTo=/onboarding"
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(15,31,77,0.18)] transition hover:bg-[#162a5c]"
      >
        <Plus size={16} />
        Ürün Ekle
      </Link>
      <Link
        href="/onboarding"
        className="mt-3 block text-sm font-semibold text-blue-600 hover:underline"
      >
        Kurulum rehberine dön
      </Link>
    </div>
  );
}
