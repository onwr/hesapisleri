"use client";

import { ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Banknote,
  Barcode,
  Bell,
  BellRing,
  BookUser,
  Boxes,
  Brain,
  Building2,
  Clock3,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Hourglass,
  Link2,
  Mail,
  MessageCircle,
  Package,
  PackageCheck,
  PlugZap,
  Plus,
  Receipt,
  ReceiptText,
  RefreshCcw,
  Repeat,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Truck,
  Upload,
  User,
  UserPlus,
  Users,
  UserX,
  Wallet,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  type CompactActionColor,
  type CompactActionIconName,
  isCompactActionIconName,
} from "@/components/cards/compact-action-card-types";

export type { CompactActionColor, CompactActionIconName } from "@/components/cards/compact-action-card-types";
export { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";

const iconMap: Record<CompactActionIconName, LucideIcon> = {
  truck: Truck,
  wallet: Wallet,
  "bell-ring": BellRing,
  "file-spreadsheet": FileSpreadsheet,
  "user-x": UserX,
  "user-plus": UserPlus,
  users: Users,
  mail: Mail,
  "shopping-cart": ShoppingCart,
  "file-text": FileText,
  "refresh-ccw": RefreshCcw,
  "receipt-text": ReceiptText,
  repeat: Repeat,
  banknote: Banknote,
  plus: Plus,
  "building-2": Building2,
  receipt: Receipt,
  "bar-chart-3": BarChart3,
  sparkles: Sparkles,
  boxes: Boxes,
  warehouse: Warehouse,
  "link-2": Link2,
  barcode: Barcode,
  "plug-zap": PlugZap,
  "credit-card": CreditCard,
  bell: Bell,
  target: Target,
  download: Download,
  "trending-up": TrendingUp,
  user: User,
  package: Package,
  clock: Clock3,
  "alert-triangle": AlertTriangle,
  "layout-grid": LayoutGrid,
  hourglass: Hourglass,
  "shopping-bag": ShoppingBag,
  "package-check": PackageCheck,
  "alert-circle": AlertCircle,
  "book-user": BookUser,
  send: Send,
  upload: Upload,
  brain: Brain,
  "message-circle": MessageCircle,
};

const iconToneMap: Record<CompactActionColor, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
  sky: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-600",
  navy: "bg-[#0f1f4d]/10 text-[#0f1f4d]",
};

type CompactActionCardBaseProps = {
  title: string;
  description: string;
  iconName: CompactActionIconName;
  color?: CompactActionColor;
  className?: string;
};

type CompactActionCardLinkProps = CompactActionCardBaseProps & {
  href: string;
  onClick?: never;
};

type CompactActionCardButtonProps = CompactActionCardBaseProps & {
  href?: never;
  onClick: () => void;
  disabled?: boolean;
};

export type CompactActionCardProps =
  | CompactActionCardLinkProps
  | CompactActionCardButtonProps;

function resolveIcon(iconName: CompactActionIconName): LucideIcon {
  if (isCompactActionIconName(iconName) && iconMap[iconName]) {
    return iconMap[iconName];
  }

  return LayoutGrid;
}

function CardInner({
  title,
  description,
  iconName,
  color = "blue",
}: CompactActionCardBaseProps) {
  const iconTone = iconToneMap[color];
  const Icon = resolveIcon(iconName);

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconTone,
          ].join(" ")}
        >
          <Icon size={20} strokeWidth={2.3} aria-hidden />
        </div>

        <div className="min-w-0">
          <p className="truncate text-[14px] font-black leading-tight text-[#0f1f4d]">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <ChevronRight
        size={16}
        strokeWidth={2.6}
        className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
        aria-hidden
      />
    </>
  );
}

const cardClassName =
  "group flex h-[80px] max-h-[88px] min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition hover:border-slate-300/80 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200";

export function CompactActionCard(props: CompactActionCardProps) {
  if ("href" in props && props.href) {
    const { href, className, ...rest } = props;

    return (
      <Link href={href} className={[cardClassName, className].filter(Boolean).join(" ")}>
        <CardInner {...rest} />
      </Link>
    );
  }

  const { onClick, disabled, className, ...rest } = props as CompactActionCardButtonProps;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        cardClassName,
        "w-full text-left disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CardInner {...rest} />
    </button>
  );
}
