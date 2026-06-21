"use client";

import type { ReactNode } from "react";

const fieldInputClass =
  "mt-1.5 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

type AdminFormFieldProps = {
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
};

export function AdminFormField({
  label,
  helper,
  error,
  children,
}: AdminFormFieldProps) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
      {helper ? (
        <span className="mt-0.5 block text-[12px] font-medium text-slate-500">
          {helper}
        </span>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-[12px] font-semibold text-rose-600">{error}</p>
      ) : null}
    </label>
  );
}

export function AdminTextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <input {...props} className={[fieldInputClass, props.className].join(" ")} />;
}

export function AdminTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={[
        "mt-1.5 min-h-40 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
        props.className,
      ].join(" ")}
    />
  );
}

export function AdminToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <span>
        <span className="block text-[13px] font-bold text-[#0f1f4d]">{label}</span>
        <span className="mt-1 block text-[12px] font-medium text-slate-500">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
    </label>
  );
}
