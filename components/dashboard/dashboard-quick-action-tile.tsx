import Link from "next/link";
import {
  FileText,
  Package,
  ReceiptText,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type DashboardQuickActionIconName =
  | "shopping-cart"
  | "file-text"
  | "receipt-text"
  | "wallet"
  | "package";

const iconMap: Record<DashboardQuickActionIconName, LucideIcon> = {
  "shopping-cart": ShoppingCart,
  "file-text": FileText,
  "receipt-text": ReceiptText,
  wallet: Wallet,
  package: Package,
};

type DashboardQuickActionTileProps = {
  title: string;
  description: string;
  href: string;
  iconName: DashboardQuickActionIconName;
  gradient: string;
};

export function DashboardQuickActionTile({
  title,
  description,
  href,
  iconName,
  gradient,
}: DashboardQuickActionTileProps) {
  const Icon = iconMap[iconName];

  return (
    <Link
      href={href}
      className={[
        "group relative flex h-full flex-col justify-between overflow-hidden rounded-[20px] p-4",
        "shadow-[0_12px_26px_rgba(15,23,42,0.14)] transition duration-200",
        "hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,23,42,0.2)]",
        gradient,
      ].join(" ")}
    >
      <span
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-md transition duration-300 group-hover:scale-110"
        aria-hidden="true"
      />

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/25">
        <Icon size={20} strokeWidth={2.3} />
      </div>

      <div className="mt-3">
        <p className="text-[14px] font-extrabold leading-tight text-white">
          {title}
        </p>
        <p className="mt-0.5 text-[12px] font-medium text-white/80">
          {description}
        </p>
      </div>
    </Link>
  );
}
