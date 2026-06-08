"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { getMarketplaceLogo, getMarketplaceName } from "@/lib/marketplace-logos";

type MarketplaceLogoProps = {
  channel: string;
  className?: string;
  iconSize?: number;
};

export function MarketplaceLogo({
  channel,
  className = "h-8 w-8",
  iconSize = 14,
}: MarketplaceLogoProps) {
  const logo = getMarketplaceLogo(channel);
  const [failed, setFailed] = useState(!logo);

  if (!logo || failed) {
    return (
      <div
        className={[
          "flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600",
          className,
        ].join(" ")}
      >
        <ShoppingBag size={iconSize} strokeWidth={2.4} />
      </div>
    );
  }

  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden rounded-full border border-slate-100 bg-white",
        className,
      ].join(" ")}
      title={getMarketplaceName(channel)}
    >
      <Image
        src={logo}
        alt={getMarketplaceName(channel)}
        fill
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
