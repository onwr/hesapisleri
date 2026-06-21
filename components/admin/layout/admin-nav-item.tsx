"use client";

import Link from "next/link";
import type { AdminNavItem } from "./admin-navigation";
import { isAdminNavItemActive } from "./admin-navigation";
import {
  appNavActiveClass,
  appNavIconActiveClass,
  appNavIconInactiveClass,
  appNavInactiveClass,
} from "@/lib/admin-ui";

type AdminNavItemProps = {
  item: AdminNavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
};

export function AdminNavItemLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: AdminNavItemProps) {
  const active = isAdminNavItemActive(pathname, item);
  const disabled = item.enabled === false;
  const Icon = item.icon;

  const className = [
    "group relative flex h-[39px] items-center rounded-2xl text-[13px] font-bold transition-all duration-200",
    collapsed ? "justify-center px-0" : "gap-3 px-3.5",
    disabled
      ? "cursor-not-allowed opacity-45"
      : active
        ? appNavActiveClass
        : appNavInactiveClass,
  ].join(" ");

  const content = (
    <>
      <Icon
        size={17}
        strokeWidth={2.15}
        className={[
          "shrink-0 transition",
          disabled
            ? "text-slate-400"
            : active
              ? appNavIconActiveClass
              : appNavIconInactiveClass,
        ].join(" ")}
        aria-hidden
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
              {item.badge}
            </span>
          ) : null}
        </>
      ) : item.badge ? (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-slate-300" />
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <div
        className={className}
        title={collapsed ? `${item.label} (${item.badge ?? "Yakında"})` : undefined}
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={className}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      {content}
    </Link>
  );
}
