import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { appHeadingClass, appSubheadingClass } from "@/lib/admin-ui";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  meta?: ReactNode;
  tabs?: ReactNode;
};

export function AdminPageHeader({
  title,
  description,
  backHref,
  icon,
  badge,
  primaryAction,
  secondaryActions,
  meta,
  tabs,
}: AdminPageHeaderProps) {
  const actions = (
    <>
      {secondaryActions}
      {primaryAction}
    </>
  );

  return (
    <div className="mb-5">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition hover:text-[#0f1f4d]"
        >
          <ArrowLeft size={16} />
          Geri
        </Link>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {icon ? (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                {icon}
              </span>
            ) : null}
            <h1 className={appHeadingClass}>{title}</h1>
            {badge}
          </div>
          {description ? (
            <p className={`mt-1 max-w-3xl ${appSubheadingClass}`}>{description}</p>
          ) : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {tabs ? <div className="mt-4">{tabs}</div> : null}
    </div>
  );
}
