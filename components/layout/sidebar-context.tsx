"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "hesapisleri_sidebar_collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setCollapsed(true);
    }
    setReady(true);
  }, []);

  // useCallback ile kararlı referans — aksi halde her SidebarProvider
  // render'ında yeni fonksiyon oluşur; AppSidebar'daki
  // `useEffect(() => closeMobile(), [pathname, closeMobile])` bağımlılık
  // dizisi her render'da değişip closeMobile'ı hemen tekrar çağırıyor ve
  // mobil menü açılır açılmaz kapanıyordu (görünürde "menü açılmıyor").
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const openMobile = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        collapsed: ready ? collapsed : false,
        toggle,
        mobileOpen,
        openMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }

  return context;
}

export function sidebarOffsetClass(collapsed: boolean) {
  return collapsed ? "lg:ml-[80px]" : "lg:ml-[250px]";
}
