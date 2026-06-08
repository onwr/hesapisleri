"use client";

import Image from "next/image";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { getBankLogo } from "@/lib/bank-logos";

type BankLogoProps = {
  name: string;
  className?: string;
  iconSize?: number;
};

export function BankLogo({
  name,
  className = "h-9 w-9",
  iconSize = 16,
}: BankLogoProps) {
  const logo = getBankLogo(name);
  const [failed, setFailed] = useState(!logo);

  if (!logo || failed) {
    return (
      <div
        className={[
          "flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600",
          className,
        ].join(" ")}
      >
        <Building2 size={iconSize} strokeWidth={2.4} />
      </div>
    );
  }

  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden rounded-full border border-slate-100 bg-white",
        className,
      ].join(" ")}
    >
      <Image
        src={logo}
        alt={name}
        fill
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
