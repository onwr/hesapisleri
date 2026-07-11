import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BookUser,
  Star,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import type { DirectorySummary } from "@/lib/directory-service";
import type {
  CompactActionColor,
  CompactActionIconName,
} from "@/components/cards/compact-action-card-types";

export type DirectoryQuickActionKey =
  | "new-person"
  | "sync-customers"
  | "sync-suppliers"
  | "sync-employees"
  | "export";

export type DirectoryQuickActionCard = {
  key: DirectoryQuickActionKey;
  title: string;
  description: string;
  iconName: CompactActionIconName;
  color: CompactActionColor;
  permission: "manage" | "view";
  href?: string;
};

export type DirectorySummaryCard = {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  color: "slate" | "emerald" | "cyan" | "violet" | "amber" | "rose" | "indigo";
};

export type DirectorySourceFilterKey =
  | "all"
  | "manual"
  | "customer"
  | "supplier"
  | "employee"
  | "favorite";

export type DirectoryFilterChipConfig = {
  key: DirectorySourceFilterKey;
  label: string;
  icon: LucideIcon;
  activeClass: string;
  idleClass: string;
};

const summaryColorMap = {
  slate: "bg-slate-50 text-slate-600",
  emerald: "bg-emerald-50 text-emerald-600",
  cyan: "bg-cyan-50 text-cyan-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-500",
  indigo: "bg-indigo-50 text-indigo-600",
} as const;

const sourceBadgeMap = {
  MANUAL: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  CUSTOMER: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  SUPPLIER: "bg-violet-50 text-violet-700 ring-violet-100",
  EMPLOYEE: "bg-amber-50 text-amber-700 ring-amber-100",
} as const;

export function getDirectorySummaryColorClass(
  color: DirectorySummaryCard["color"]
) {
  return summaryColorMap[color];
}

export function getDirectorySourceBadgeClass(
  sourceType: string | null | undefined
) {
  if (!sourceType || sourceType === "MANUAL") {
    return sourceBadgeMap.MANUAL;
  }

  if (sourceType in sourceBadgeMap) {
    return sourceBadgeMap[sourceType as keyof typeof sourceBadgeMap];
  }

  return "bg-slate-50 text-slate-600 ring-slate-100";
}

export type DirectoryDistributionItem = {
  label: string;
  count: number;
  percent: number;
  color: string;
};

export function buildDirectoryQuickActionCards(): DirectoryQuickActionCard[] {
  return [
    {
      key: "new-person",
      title: "Yeni Kişi",
      description: "Manuel kayıt oluştur",
      iconName: "user-plus",
      color: "emerald",
      permission: "manage",
    },
    {
      key: "sync-customers",
      title: "Müşterileri Aktar",
      description: "Müşteri kartlarını aktar",
      iconName: "users",
      color: "sky",
      permission: "manage",
    },
    {
      key: "sync-suppliers",
      title: "Tedarikçileri Aktar",
      description: "Tedarikçi kartlarını aktar",
      iconName: "truck",
      color: "orange",
      permission: "manage",
    },
    {
      key: "sync-employees",
      title: "Çalışanları Aktar",
      description: "Çalışan kayıtlarını aktar",
      iconName: "book-user",
      color: "violet",
      permission: "manage",
    },
    {
      key: "export",
      title: "Dışa Aktar",
      description: "Fihristi CSV olarak indir",
      iconName: "download",
      color: "rose",
      permission: "view",
    },
  ];
}

export function filterDirectoryQuickActionCards(
  cards: DirectoryQuickActionCard[],
  canManage: boolean
) {
  return cards.filter((card) => {
    if (card.permission === "manage") return canManage;
    return true;
  });
}

export function buildDirectorySummaryCards(
  summary: DirectorySummary
): DirectorySummaryCard[] {
  return [
    {
      key: "total",
      title: "Toplam Kayıt",
      value: String(summary.total),
      subtitle: "Aktif fihrist kaydı",
      icon: BookUser,
      color: "slate",
    },
    {
      key: "manual",
      title: "Manuel Kayıt",
      value: String(summary.manual),
      subtitle: "Elle oluşturulan",
      icon: UserPlus,
      color: "emerald",
    },
    {
      key: "customers",
      title: "Müşteriler",
      value: String(summary.crmActiveCustomers),
      subtitle:
        summary.customers > 0
          ? `Fihristte ${summary.customers} senkronize kayıt`
          : "Senkronize etmek için Müşterileri Aktar",
      icon: Users,
      color: "cyan",
    },
    {
      key: "suppliers",
      title: "Tedarikçiler",
      value: String(summary.suppliers),
      subtitle: "Tedarikçi kaynağı",
      icon: Truck,
      color: "violet",
    },
    {
      key: "employees",
      title: "Çalışanlar",
      value: String(summary.employees),
      subtitle: "Çalışan kaynağı",
      icon: BookUser,
      color: "amber",
    },
  ];
}

export function buildDirectoryExtendedSummaryCards(
  summary: DirectorySummary
): DirectorySummaryCard[] {
  return [
    {
      key: "favorites",
      title: "Favoriler",
      value: String(summary.favorites),
      subtitle: "Sık kullanılan kişi",
      icon: Star,
      color: "rose",
    },
    {
      key: "missing-info",
      title: "Eksik Bilgi",
      value: String(summary.missingInfo),
      subtitle: "Telefon ve e-posta yok",
      icon: AlertCircle,
      color: "indigo",
    },
  ];
}

export function buildDirectoryDistribution(
  summary: DirectorySummary
): DirectoryDistributionItem[] {
  const total = summary.total > 0 ? summary.total : 1;

  return [
    {
      label: "Manuel",
      count: summary.manual,
      percent: Math.round((summary.manual / total) * 100),
      color: "#10b981",
    },
    {
      label: "Senkronize Müşteri",
      count: summary.customers,
      percent: Math.round((summary.customers / total) * 100),
      color: "#06b6d4",
    },
    {
      label: "Tedarikçi",
      count: summary.suppliers,
      percent: Math.round((summary.suppliers / total) * 100),
      color: "#8b5cf6",
    },
    {
      label: "Çalışan",
      count: summary.employees,
      percent: Math.round((summary.employees / total) * 100),
      color: "#f59e0b",
    },
    {
      label: "Favori",
      count: summary.favorites,
      percent: Math.round((summary.favorites / total) * 100),
      color: "#f43f5e",
    },
  ];
}

export function buildDirectoryFilterChips(): DirectoryFilterChipConfig[] {
  return [
    {
      key: "all",
      label: "Tüm Kayıtlar",
      icon: BookUser,
      activeClass: "bg-slate-800 text-white shadow-sm",
      idleClass:
        "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50",
    },
    {
      key: "manual",
      label: "Manuel",
      icon: UserPlus,
      activeClass: "bg-emerald-600 text-white shadow-sm",
      idleClass:
        "border border-emerald-100 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50",
    },
    {
      key: "customer",
      label: "Müşteri",
      icon: Users,
      activeClass: "bg-cyan-600 text-white shadow-sm",
      idleClass:
        "border border-cyan-100 bg-cyan-50/60 text-cyan-700 hover:bg-cyan-50",
    },
    {
      key: "supplier",
      label: "Tedarikçi",
      icon: Truck,
      activeClass: "bg-violet-600 text-white shadow-sm",
      idleClass:
        "border border-violet-100 bg-violet-50/60 text-violet-700 hover:bg-violet-50",
    },
    {
      key: "employee",
      label: "Çalışan",
      icon: BookUser,
      activeClass: "bg-amber-600 text-white shadow-sm",
      idleClass:
        "border border-amber-100 bg-amber-50/60 text-amber-700 hover:bg-amber-50",
    },
    {
      key: "favorite",
      label: "Favoriler",
      icon: Star,
      activeClass: "bg-rose-600 text-white shadow-sm",
      idleClass:
        "border border-rose-100 bg-rose-50/60 text-rose-700 hover:bg-rose-50",
    },
  ];
}

export function getActiveDirectoryFilterChip(input: {
  sourceType: string;
  favorite: string;
}): DirectorySourceFilterKey {
  if (input.favorite === "yes") return "favorite";
  if (input.sourceType === "MANUAL") return "manual";
  if (input.sourceType === "CUSTOMER") return "customer";
  if (input.sourceType === "SUPPLIER") return "supplier";
  if (input.sourceType === "EMPLOYEE") return "employee";
  return "all";
}

export function applyDirectoryFilterChip(
  key: DirectorySourceFilterKey
): { sourceType: string; favorite: string } {
  if (key === "favorite") {
    return { sourceType: "ALL", favorite: "yes" };
  }
  if (key === "manual") {
    return { sourceType: "MANUAL", favorite: "ALL" };
  }
  if (key === "customer") {
    return { sourceType: "CUSTOMER", favorite: "ALL" };
  }
  if (key === "supplier") {
    return { sourceType: "SUPPLIER", favorite: "ALL" };
  }
  if (key === "employee") {
    return { sourceType: "EMPLOYEE", favorite: "ALL" };
  }
  return { sourceType: "ALL", favorite: "ALL" };
}

export function getDirectoryAvatarClass(
  sourceType: string | null | undefined
) {
  if (sourceType === "CUSTOMER") {
    return "bg-linear-to-br from-cyan-500 to-blue-500 text-white";
  }
  if (sourceType === "SUPPLIER") {
    return "bg-linear-to-br from-violet-500 to-purple-600 text-white";
  }
  if (sourceType === "EMPLOYEE") {
    return "bg-linear-to-br from-orange-500 to-amber-500 text-white";
  }
  return "bg-linear-to-br from-emerald-500 to-teal-500 text-white";
}
