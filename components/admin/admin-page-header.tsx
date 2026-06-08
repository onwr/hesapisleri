import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  title,
  description,
  backHref,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        {backHref ? (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition hover:text-[#0f1f4d]"
          >
            <ArrowLeft size={16} />
            Geri
          </Link>
        ) : null}
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0f1f4d]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[14px] font-medium text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
