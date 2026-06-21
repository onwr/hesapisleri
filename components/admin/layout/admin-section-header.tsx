import type { ReactNode } from "react";
import { appHeadingClass, appSubheadingClass } from "@/lib/admin-ui";

type AdminSectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function AdminSectionHeader({
  title,
  description,
  action,
}: AdminSectionHeaderProps) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-extrabold text-[#0f1f4d]">
          {title}
        </h2>
        {description ? (
          <p className={`mt-0.5 ${appSubheadingClass}`}>{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
