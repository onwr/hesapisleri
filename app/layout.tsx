import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PlatformRuntimeProvider } from "@/components/platform-runtime/platform-runtime-provider";
import { getPublicPlatformRuntimeConfig } from "@/lib/platform-runtime";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata = {
  title: "Hesapişleri.com",
  description: "Yeni nesil işletme yönetim platformu",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const runtimeConfig = await getPublicPlatformRuntimeConfig();

  return (
    <html lang="tr" className={`${plusJakarta.variable} h-full`} suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} min-h-full font-sans antialiased`}
        suppressHydrationWarning
      >
        <PlatformRuntimeProvider config={runtimeConfig}>{children}</PlatformRuntimeProvider>
      </body>
    </html>
  );
}
