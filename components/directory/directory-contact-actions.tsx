"use client";

import { Mail, Phone } from "lucide-react";
import {
  formatEmailHref,
  formatPhoneHref,
} from "@/lib/directory-utils";

type DirectoryContactActionsProps = {
  phone?: string | null;
  mobilePhone?: string | null;
  email?: string | null;
  compact?: boolean;
  onClick?: (event: React.MouseEvent) => void;
};

export function DirectoryContactActions({
  phone,
  mobilePhone,
  email,
  compact = false,
  onClick,
}: DirectoryContactActionsProps) {
  const phoneHref = formatPhoneHref(phone ?? mobilePhone);
  const emailHref = formatEmailHref(email);

  if (!phoneHref && !emailHref) {
    return compact ? null : (
      <span className="text-[11px] text-slate-400">—</span>
    );
  }

  const buttonClass = compact
    ? "rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100"
    : "inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {phoneHref ? (
        <a
          href={phoneHref}
          onClick={onClick}
          className={buttonClass}
          title="Ara"
          aria-label="Telefon ara"
        >
          <Phone size={14} />
          {!compact ? "Ara" : null}
        </a>
      ) : null}
      {emailHref ? (
        <a
          href={emailHref}
          onClick={onClick}
          className={buttonClass}
          title="E-posta gönder"
          aria-label="E-posta gönder"
        >
          <Mail size={14} />
          {!compact ? "E-posta" : null}
        </a>
      ) : null}
    </div>
  );
}
