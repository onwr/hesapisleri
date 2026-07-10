import Link from "next/link";

export function SkipToContentLink() {
  return (
    <Link
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-[#0f1f4d] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
    >
      İçeriğe geç
    </Link>
  );
}
