"use client";

type CategoryOption = {
  id: string;
  name: string;
};

type PosCategoryFilterProps = {
  categories: CategoryOption[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
};

export function PosCategoryFilter({
  categories,
  selectedCategoryId,
  onSelect,
}: PosCategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={[
          "h-11 rounded-2xl px-4 text-sm font-black transition",
          selectedCategoryId === ""
            ? "bg-slate-950 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        ].join(" ")}
      >
        Tümü
      </button>

      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={[
            "h-11 rounded-2xl px-4 text-sm font-black transition",
            selectedCategoryId === category.id
              ? "bg-blue-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
