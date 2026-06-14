"use client";

import { getEmployeeInitials } from "@/lib/employee-page-utils";

type EmployeeAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "list" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClass = {
  list: "h-11 w-11 rounded-full text-xs",
  sm: "h-11 w-11 rounded-full text-xs",
  md: "h-14 w-14 rounded-full text-sm",
  lg: "h-20 w-20 rounded-full text-lg",
  xl: "h-24 w-24 rounded-full text-xl",
};

export function EmployeeAvatar({
  name,
  avatarUrl,
  size = "sm",
  className = "",
}: EmployeeAvatarProps) {
  const baseClass = [
    "flex shrink-0 items-center justify-center overflow-hidden font-black text-white",
    sizeClass[size],
    avatarUrl
      ? "bg-slate-100 ring-1 ring-slate-200"
      : "bg-linear-to-br from-blue-500 to-violet-600",
    className,
  ].join(" ");

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={name} className={[baseClass, "object-cover"].join(" ")} />
    );
  }

  return <div className={baseClass}>{getEmployeeInitials(name)}</div>;
}
