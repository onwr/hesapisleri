import type { ReactNode } from "react";

type AdminPageContainerProps = {
  children: ReactNode;
  size?: "default" | "wide" | "full";
  className?: string;
};

const sizeClass = {
  default: "max-w-6xl",
  wide: "max-w-[1440px]",
  full: "max-w-none",
};

/**
 * Shell (`AdminShellMain`) zaten px-5/py-6 padding verir.
 * Bu component yalnız max-width ve section spacing sağlar.
 */
export function AdminPageContainer({
  children,
  size = "wide",
  className = "",
}: AdminPageContainerProps) {
  return (
    <div
      className={[
        "mx-auto w-full min-w-0 space-y-6",
        sizeClass[size],
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
