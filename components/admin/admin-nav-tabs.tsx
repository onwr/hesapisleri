"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  Logs,
  Users,
} from "lucide-react";

const tabs = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/admin/companies", label: "Firmalar", icon: Building2 },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users },
  { href: "/admin/payments", label: "Ödemeler", icon: CreditCard },
  { href: "/admin/logs", label: "Kayıtlar", icon: Logs },
];

export function AdminNavTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-[13px] font-bold transition",
              active
                ? "border-[#0f1f4d] bg-[#0f1f4d] text-white shadow-[0_10px_24px_rgba(15,31,77,0.18)]"
                : "border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-[#0f1f4d]",
            ].join(" ")}
          >
            <Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
