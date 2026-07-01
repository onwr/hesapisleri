import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type ActionCardProps = {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  gradient: string;
};

export function ActionCard({
  title,
  description,
  href,
  icon,
  gradient,
}: ActionCardProps) {
  return (
    <Link
      href={href}
      className={`group flex h-[86px] items-center justify-between rounded-2xl p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${gradient}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold leading-tight">
            {title}
          </p>
          <p className="mt-1 truncate text-xs font-medium text-white">
            {description}
          </p>
        </div>
      </div>

      <ChevronRight
        size={18}
        className="shrink-0 opacity-80 transition group-hover:translate-x-1 group-hover:opacity-100"
      />
    </Link>
  );
}