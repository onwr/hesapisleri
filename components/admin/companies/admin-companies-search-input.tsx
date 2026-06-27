"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  defaultValue?: string;
  placeholder?: string;
};

export function AdminCompaniesSearchInput({
  defaultValue = "",
  placeholder = "Firma, sahip, vergi no, ID...",
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (value === defaultValue) return;
    if (value.length > 0 && value.length < 2) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      router.push(`/admin/companies?${params.toString()}`);
    }, 350);

    return () => clearTimeout(timer);
  }, [value, defaultValue, router]);

  return (
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm"
    />
  );
}
