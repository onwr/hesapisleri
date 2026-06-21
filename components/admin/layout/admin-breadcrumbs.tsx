"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ADMIN_ROUTE_LABELS } from "./admin-navigation";
import { appSubheadingClass } from "@/lib/admin-ui";

type AdminBreadcrumbsProps = {
  dynamicLabels?: Record<string, string>;
};

export function AdminBreadcrumbs({ dynamicLabels }: AdminBreadcrumbsProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return (
      <nav aria-label="Breadcrumb" className="min-w-0">
        <p className={`truncate text-[13px] font-bold text-[#0f1f4d]`}>
          Platform Yönetimi
        </p>
      </nav>
    );
  }

  const crumbs: { href: string; label: string }[] = [];
  let href = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    href += `/${segment}`;

    if (i === 0) {
      crumbs.push({ href: "/admin", label: "Platform Yönetimi" });
      continue;
    }

    const label =
      dynamicLabels?.[segment] ??
      ADMIN_ROUTE_LABELS[segment] ??
      (segment.length > 20 ? `${segment.slice(0, 8)}…` : segment);

    crumbs.push({ href, label });
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[12px] font-medium">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight size={13} className="shrink-0 text-slate-300" />
              ) : null}
              {isLast ? (
                <span className="truncate font-bold text-[#0f1f4d]">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className={`truncate ${appSubheadingClass} hover:text-[#0f1f4d]`}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
