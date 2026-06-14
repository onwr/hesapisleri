"use client";

import Image from "next/image";
import { useState } from "react";
import type { MarketplaceChannelKey } from "@/lib/marketplace/marketplace-types";
import { getMarketplaceLogo, getMarketplaceName } from "@/lib/marketplace-logos";
import { CHANNEL_UI_CONFIG } from "@/components/settings/integrations/integration-ui-config";

type IntegrationChannelLogoProps = {
  channel: MarketplaceChannelKey;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES = {
  sm: "h-8 w-8 rounded-xl p-1",
  md: "h-14 w-14 rounded-2xl p-2",
  lg: "h-16 w-16 rounded-2xl p-2.5",
} as const;

const FALLBACK_TEXT = {
  sm: "text-xs",
  md: "text-lg",
  lg: "text-xl",
} as const;

export function IntegrationChannelLogo({
  channel,
  size = "md",
  className = "",
}: IntegrationChannelLogoProps) {
  const config = CHANNEL_UI_CONFIG[channel];
  const logo = getMarketplaceLogo(channel);
  const [failed, setFailed] = useState(!logo);

  if (!logo || failed) {
    return (
      <div
        className={[
          "flex shrink-0 items-center justify-center font-black shadow-sm",
          SIZE_CLASSES[size],
          config.iconClass,
          FALLBACK_TEXT[size],
          className,
        ].join(" ")}
        title={config.title}
      >
        {config.shortLabel}
      </div>
    );
  }

  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden border border-slate-100 bg-white shadow-sm",
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
      title={getMarketplaceName(channel)}
    >
      <Image
        src={logo}
        alt={getMarketplaceName(channel)}
        fill
        sizes={size === "sm" ? "32px" : size === "md" ? "56px" : "64px"}
        className="object-contain p-0.5"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
