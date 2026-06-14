"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type IntegrationSecretInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  savedBadge?: string | null;
};

export function IntegrationSecretInput({
  id,
  value,
  onChange,
  placeholder,
  savedBadge,
}: IntegrationSecretInputProps) {
  const [visible, setVisible] = useState(false);
  const canToggle = value.length > 0;

  return (
    <div className="mt-1">
      <div className="relative">
        <input
          id={id}
          type={visible && canToggle ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 px-3 pr-10 text-sm outline-none focus:border-blue-400"
          placeholder={placeholder}
          autoComplete="off"
        />
        {canToggle ? (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={visible ? "Gizle" : "Göster"}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : null}
      </div>
      {savedBadge && value.length === 0 ? (
        <span className="mt-1.5 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
          {savedBadge}
        </span>
      ) : null}
    </div>
  );
}
