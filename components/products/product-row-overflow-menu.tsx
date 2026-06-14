"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { ProductsRowActions } from "@/components/products/products-row-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProductRowActionData } from "@/lib/products-page-utils";

type ProductRowOverflowMenuProps = {
  row: ProductRowActionData;
  onDeleteBlocked?: Parameters<typeof ProductsRowActions>[0]["onDeleteBlocked"];
};

export function ProductRowOverflowMenu({
  row,
  onDeleteBlocked,
}: ProductRowOverflowMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
          title="İşlemler"
        >
          <MoreHorizontal size={15} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="bottom"
        className="w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
      >
        <ProductsRowActions
          row={row}
          onDeleteBlocked={onDeleteBlocked}
          variant="menu"
          onAction={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
