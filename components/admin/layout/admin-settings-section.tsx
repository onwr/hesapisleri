import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { appPanelClass } from "@/lib/admin-ui";

type AdminSettingsSectionProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AdminSettingsSection({
  title,
  description,
  icon: Icon,
  children,
  footer,
  className = "",
}: AdminSettingsSectionProps) {
  return (
    <section className={`${appPanelClass} overflow-hidden ${className}`}>
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          ) : null}
          <div>
            <h2 className="text-[15px] font-extrabold text-[#0f1f4d]">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] font-medium text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
      {footer ? (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
