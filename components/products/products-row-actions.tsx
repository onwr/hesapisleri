"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Boxes,
  Download,
  Edit3,
  Eye,
  MoreVertical,
  Power,
  Printer,
  ScanBarcode,
  Trash2,
  Warehouse,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { printProductBarcode } from "@/lib/product-ui-utils";
import type { ProductRowActionData } from "@/lib/products-page-utils";

type DeleteBlockedPayload = {
  productId: string;
  productName: string;
  code?: string;
  message: string;
  saleItemCount?: number;
  transferCount?: number;
};

type ProductsRowActionsProps = {
  row: ProductRowActionData;
  onDeleteBlocked?: (payload: DeleteBlockedPayload) => void;
  variant?: "inline" | "menu";
  onAction?: () => void;
};

export function ProductsRowActions({
  row,
  onDeleteBlocked,
  variant = "inline",
  onAction,
}: ProductsRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const isActive = row.status === "ACTIVE";
  const isBusy = isPending;

  async function handleToggleStatus() {
    setMessage(null);
    onAction?.();

    startTransition(async () => {
      try {
        const response = await fetch(`/api/products/${row.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle-status" }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) {
          setMessage(result.message ?? "Durum güncellenemedi.");
          return;
        }

        router.refresh();
      } catch {
        setMessage("Durum güncellenirken bir hata oluştu.");
      }
    });
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `"${row.name}" ürününü kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz. Satış veya transfer geçmişi varsa silme engellenir.`
    );

    if (!confirmed) return;

    setMessage(null);
    onAction?.();

    startTransition(async () => {
      try {
        const response = await fetch(`/api/products/${row.id}`, {
          method: "DELETE",
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
          code?: string;
          saleItemCount?: number;
          transferCount?: number;
        };

        if (!response.ok || !result.success) {
          const payload: DeleteBlockedPayload = {
            productId: row.id,
            productName: row.name,
            code: result.code,
            message: result.message ?? "Ürün silinemedi.",
            saleItemCount: result.saleItemCount,
            transferCount: result.transferCount,
          };

          if (onDeleteBlocked) {
            onDeleteBlocked(payload);
          } else {
            setMessage(payload.message);
          }
          return;
        }

        router.refresh();
      } catch {
        setMessage("Ürün silinirken bir hata oluştu.");
      }
    });
  }

  function handlePrintBarcode() {
    onAction?.();
    printProductBarcode({
      name: row.name,
      barcode: row.barcode ?? null,
      sku: row.sku,
      sellPriceLabel: row.sellPriceLabel,
    });
  }

  if (variant === "menu") {
    return (
      <div className="space-y-1">
        <MenuLink href={`/products/${row.id}`} icon={<Eye size={14} />} onAction={onAction}>
          Detay
        </MenuLink>
        <MenuLink
          href={`/products/${row.id}/edit`}
          icon={<Edit3 size={14} />}
          onAction={onAction}
        >
          Düzenle
        </MenuLink>
        {!row.isService ? (
          <MenuLink
            href={`/products/${row.id}/stock`}
            icon={<Boxes size={14} />}
            onAction={onAction}
          >
            Stok Hareketi
          </MenuLink>
        ) : null}
        <MenuButton icon={<Printer size={14} />} onClick={handlePrintBarcode}>
          Barkod Yazdır
        </MenuButton>
        <MenuLink href="/pos" icon={<ScanBarcode size={14} />} onAction={onAction}>
          POS&apos;ta Gör
        </MenuLink>
        <MenuButton
          icon={<Power size={14} />}
          onClick={() => void handleToggleStatus()}
          disabled={isBusy}
        >
          {isBusy ? "Güncelleniyor..." : isActive ? "Pasif Yap" : "Aktif Yap"}
        </MenuButton>
        <MenuButton
          icon={<Trash2 size={14} />}
          onClick={() => void handleDelete()}
          disabled={isBusy}
          destructive
        >
          {isBusy ? "Siliniyor..." : "Sil"}
        </MenuButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center gap-2">
        <Link
          href={`/products/${row.id}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
          title="Detay"
        >
          <Eye size={15} />
        </Link>

        <Link
          href={`/products/${row.id}/edit`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
          title="Düzenle"
        >
          <Edit3 size={15} />
        </Link>

        <button
          type="button"
          onClick={handlePrintBarcode}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
          title="Barkod Yazdır"
        >
          <Printer size={15} />
        </button>

        <a
          href={row.exportHref}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
          title="Fiyat listesini indir"
        >
          <Download size={15} />
        </a>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={isBusy}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              title="İşlemler"
            >
              <MoreVertical size={15} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate text-[11px] font-bold text-slate-500">
              {row.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href={`/products/${row.id}`} className="cursor-pointer">
                <Eye size={14} />
                Detay görüntüle
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href={`/products/${row.id}/edit`} className="cursor-pointer">
                <Edit3 size={14} />
                Ürünü düzenle
              </Link>
            </DropdownMenuItem>

            {!row.isService ? (
              <DropdownMenuItem asChild>
                <Link
                  href={`/products/${row.id}/stock`}
                  className="cursor-pointer"
                >
                  <Boxes size={14} />
                  Stok hareketi
                </Link>
              </DropdownMenuItem>
            ) : null}

            {!row.isService ? (
              <DropdownMenuItem asChild>
                <Link href="/products/stocks" className="cursor-pointer">
                  <Warehouse size={14} />
                  Stok merkezi
                </Link>
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuItem asChild>
              <Link href="/pos" className="cursor-pointer">
                <ScanBarcode size={14} />
                POS&apos;ta gör
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handlePrintBarcode} className="cursor-pointer">
              <Printer size={14} />
              Barkod yazdır
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <a href={row.exportHref} className="cursor-pointer">
                <Download size={14} />
                Fiyat listesini indir
              </a>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => void handleToggleStatus()}
              className="cursor-pointer"
              disabled={isBusy}
            >
              <Power size={14} />
              {isBusy
                ? "Güncelleniyor..."
                : isActive
                  ? "Pasife al"
                  : "Aktifleştir"}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={() => void handleDelete()}
              className="cursor-pointer"
              disabled={isBusy}
            >
              <Trash2 size={14} />
              {isBusy ? "Siliniyor..." : "Ürünü sil"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {message ? (
        <p className="max-w-[220px] text-center text-[10px] font-bold text-rose-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onAction,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onAction?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onAction}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-[#0f1f4d] transition hover:bg-slate-50"
    >
      {icon}
      {children}
    </Link>
  );
}

function MenuButton({
  icon,
  children,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-bold transition disabled:opacity-60",
        destructive
          ? "text-rose-600 hover:bg-rose-50"
          : "text-[#0f1f4d] hover:bg-slate-50",
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}
