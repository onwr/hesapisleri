"use client";

import { Package } from "lucide-react";

type ProductThumbnailProps = {
  imageUrl?: string | null;
  alt: string;
  size?: number;
  className?: string;
  iconSize?: number;
  dimmed?: boolean;
  rounded?: "lg" | "xl" | "2xl" | "3xl";
};

const roundedMap = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

export function ProductThumbnail({
  imageUrl,
  alt,
  size = 40,
  className = "",
  iconSize = 18,
  dimmed = false,
  rounded = "lg",
}: ProductThumbnailProps) {
  const roundedClass = roundedMap[rounded];

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 text-slate-400",
        roundedClass,
        dimmed ? "opacity-60" : "",
        className,
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <Package size={iconSize} strokeWidth={2.2} />
      )}
    </div>
  );
}
