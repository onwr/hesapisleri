import { UsersRound } from "lucide-react";

type TeamEmptyStateProps = {
  tab: string;
  hasFilters: boolean;
  onClear?: () => void;
};

export function TeamEmptyState({
  tab,
  hasFilters,
  onClear,
}: TeamEmptyStateProps) {
  const title =
    tab === "invites"
      ? "Bekleyen davet yok"
      : tab === "passive"
        ? "Pasif çalışan yok"
        : hasFilters
          ? "Filtreye uygun çalışan bulunamadı"
          : "Henüz çalışan yok";

  const description =
    tab === "invites"
      ? "Yeni ekip üyelerini davet ederek firmanıza ekleyebilirsiniz."
      : tab === "passive"
        ? "Firmadan çıkarılan veya pasif durumdaki çalışanlar burada listelenir."
        : hasFilters
          ? "Arama veya filtre kriterlerinizi değiştirerek tekrar deneyin."
          : "İlk çalışanınızı davet ederek ekibinizi oluşturabilirsiniz.";

  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-blue-50 text-blue-600">
        <UsersRound size={28} />
      </div>
      <p className="mt-4 text-lg font-black text-[#0f1f4d]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
      {hasFilters && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
        >
          Filtreyi Temizle
        </button>
      ) : null}
    </div>
  );
}
