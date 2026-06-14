import Link from "next/link";
import type { ReactNode } from "react";

type ProductActionButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function ProductActionButton({
  href,
  children,
  variant = "secondary",
}: ProductActionButtonProps) {
  if (variant === "primary") {
    return (
      <Link
        href={href}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(15,31,77,0.18)] transition hover:bg-[#162a5c]"
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-black text-[#0f1f4d] transition hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}
