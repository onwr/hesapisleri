"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, MoreVertical, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";
import type { LifecycleActionMatrix } from "@/lib/transaction-lifecycle-policy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type TransactionRecordActionsProps = {
  actions: LifecycleActionMatrix;
  viewHref?: string;
  editHref?: string;
  onCancel?: () => void;
  onReverse?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  ariaLabel?: string;
};

export function TransactionRecordActions({
  actions,
  viewHref,
  editHref,
  onCancel,
  onReverse,
  onDelete,
  onArchive,
  onRestore,
  ariaLabel = "Kayıt işlemleri",
}: TransactionRecordActionsProps) {
  const [open, setOpen] = useState(false);

  const hasMenu =
    actions.view ||
    actions.edit ||
    actions.cancel ||
    actions.reverse ||
    actions.delete ||
    actions.archive ||
    actions.restore;

  if (!hasMenu) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-slate-500"
          aria-label={ariaLabel}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {actions.view && viewHref ? (
          <DropdownMenuItem asChild>
            <Link href={viewHref} className="flex items-center gap-2">
              <Eye size={14} />
              Görüntüle
            </Link>
          </DropdownMenuItem>
        ) : null}

        {actions.edit && editHref ? (
          <DropdownMenuItem asChild>
            <Link href={editHref} className="flex items-center gap-2">
              <Pencil size={14} />
              Düzenle
            </Link>
          </DropdownMenuItem>
        ) : null}

        {(actions.view || actions.edit) &&
        (actions.cancel || actions.reverse || actions.delete || actions.archive || actions.restore) ? (
          <DropdownMenuSeparator />
        ) : null}

        {actions.cancel && onCancel ? (
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              onCancel();
            }}
            className="flex items-center gap-2 text-amber-700 focus:text-amber-700"
          >
            <XCircle size={14} />
            İptal Et
          </DropdownMenuItem>
        ) : null}

        {actions.reverse && onReverse ? (
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              onReverse();
            }}
            className="flex items-center gap-2 text-indigo-700 focus:text-indigo-700"
          >
            <RotateCcw size={14} />
            Ters Kayıt Oluştur
          </DropdownMenuItem>
        ) : null}

        {actions.delete && onDelete ? (
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex items-center gap-2 text-rose-700 focus:text-rose-700"
          >
            <Trash2 size={14} />
            Sil
          </DropdownMenuItem>
        ) : null}

        {actions.archive && onArchive ? (
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              onArchive();
            }}
          >
            Arşivle
          </DropdownMenuItem>
        ) : null}

        {actions.restore && onRestore ? (
          <DropdownMenuItem
            onClick={() => {
              setOpen(false);
              onRestore();
            }}
          >
            Arşivden Çıkar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
