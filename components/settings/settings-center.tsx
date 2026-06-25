"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  Database,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  Phone,
  PlugZap,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ActionCard } from "@/components/cards/action-card";
import { StatCard } from "@/components/cards/stat-card";
import { SettingsUsersPanel } from "@/components/settings/settings-users-panel";
import { TeamSettingsBanner } from "@/components/settings/team-settings-banner";
import { TeamActionButton } from "@/components/team/team-action-button";
import type { SerializedSettingsBundle } from "@/lib/settings-service";
import { formatMoney, formatNumber } from "@/lib/format-utils";
import { getInvoiceTypeLabel } from "@/lib/settings-utils";
import { uploadImageToCdn } from "@/lib/storage/upload-client";

type SettingsSection =
  | "company"
  | "users"
  | "invoice"
  | "cash-bank"
  | "integrations"
  | "notifications"
  | "data"
  | "membership";

const MENU_ITEMS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: "company",
    label: "Firma Bilgileri",
    description: "Logo, vergi ve iletişim",
    icon: <Building2 size={18} />,
  },
  {
    id: "users",
    label: "Kullanıcı ve Rol",
    description: "Ekip erişimi",
    icon: <Users size={18} />,
  },
  {
    id: "invoice",
    label: "Fatura Ayarları",
    description: "e-Fatura tercihleri",
    icon: <FileText size={18} />,
  },
  {
    id: "cash-bank",
    label: "Kasa & Banka",
    description: "Varsayılan hesaplar",
    icon: <Wallet size={18} />,
  },
  {
    id: "integrations",
    label: "Entegrasyonlar",
    description: "Pazaryeri bağlantıları",
    icon: <PlugZap size={18} />,
  },
  {
    id: "notifications",
    label: "Bildirimler",
    description: "Uyarı tercihleri",
    icon: <Bell size={18} />,
  },
  {
    id: "data",
    label: "Veri / Yedekleme",
    description: "CSV dışa aktarım",
    icon: <Database size={18} />,
  },
  {
    id: "membership",
    label: "Üyelik ve Ödeme",
    description: "Paket ve ödeme",
    icon: <CreditCard size={18} />,
  },
];

type SettingsCenterProps = {
  initialData: SerializedSettingsBundle;
  canManageUsers?: boolean;
  canManageSettings?: boolean;
  canManageMembership?: boolean;
};

export function SettingsCenter({
  initialData,
  canManageUsers = false,
  canManageSettings = true,
  canManageMembership = false,
}: SettingsCenterProps) {
  const visibleMenuItems = useMemo(() => {
    return MENU_ITEMS.filter((item) => {
      if (item.id === "users") return canManageUsers;
      if (item.id === "membership") return canManageMembership;
      if (
        !canManageSettings &&
        (item.id === "invoice" || item.id === "cash-bank")
      ) {
        return false;
      }
      return true;
    });
  }, [canManageUsers, canManageSettings, canManageMembership]);

  const [activeSection, setActiveSection] = useState<SettingsSection>(
    visibleMenuItems[0]?.id ?? "company"
  );
  const [bundle, setBundle] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(true);

  const [companyForm, setCompanyForm] = useState({
    name: bundle.company.name,
    phone: bundle.company.phone ?? "",
    email: bundle.company.email ?? "",
    taxNo: bundle.company.taxNo ?? "",
    taxOffice: bundle.company.taxOffice ?? "",
    address: bundle.company.address ?? "",
    logoUrl: bundle.company.logoUrl ?? "",
    currency: bundle.settings.currency,
    defaultVatRate: String(bundle.settings.defaultVatRate),
  });

  const [invoiceForm, setInvoiceForm] = useState({
    defaultInvoiceType: bundle.settings.defaultInvoiceType,
    invoiceNumberPrefix: bundle.settings.invoiceNumberPrefix,
    defaultDueDays: String(bundle.settings.defaultDueDays),
    defaultVatRate: String(bundle.settings.defaultVatRate),
    invoiceNoteTemplate: bundle.settings.invoiceNoteTemplate ?? "",
  });

  const [cashBankForm, setCashBankForm] = useState({
    defaultCollectionAccountId:
      bundle.settings.defaultCollectionAccountId ?? "",
    defaultExpenseAccountId: bundle.settings.defaultExpenseAccountId ?? "",
    autoCreateCashAccount: bundle.settings.autoCreateCashAccount,
    hideInactiveAccounts: bundle.settings.hideInactiveAccounts,
  });

  const [notificationForm, setNotificationForm] = useState({
    notifyLowStock: bundle.settings.notifyLowStock,
    notifyDueInvoices: bundle.settings.notifyDueInvoices,
    notifyLateCollections: bundle.settings.notifyLateCollections,
    notifyDailySummary: bundle.settings.notifyDailySummary,
    notifyEmployeePayments: bundle.settings.notifyEmployeePayments ?? true,
  });

  const visibleAccounts = useMemo(() => {
    if (!cashBankForm.hideInactiveAccounts) {
      return bundle.accounts;
    }

    return bundle.accounts.filter((account) => account.status === "ACTIVE");
  }, [bundle.accounts, cashBankForm.hideInactiveAccounts]);

  const activeMenu =
    visibleMenuItems.find((item) => item.id === activeSection) ??
    visibleMenuItems[0]!;

  const activeUserCount = useMemo(
    () => bundle.users.filter((user) => user.status === "ACTIVE").length,
    [bundle.users]
  );

  const activeAccountCount = useMemo(
    () => bundle.accounts.filter((account) => account.status === "ACTIVE").length,
    [bundle.accounts]
  );

  const activeNotificationCount = useMemo(
    () =>
      [
        notificationForm.notifyLowStock,
        notificationForm.notifyDueInvoices,
        notificationForm.notifyLateCollections,
        notificationForm.notifyDailySummary,
        notificationForm.notifyEmployeePayments,
      ].filter(Boolean).length,
    [notificationForm]
  );

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setError("");

    try {
      const url = await uploadImageToCdn(
        file,
        `hesapisleri/companies/${bundle.company.id}`
      );
      setCompanyForm((prev) => ({ ...prev, logoUrl: url }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Logo yüklenirken hata oluştu."
      );
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function saveCompany() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...companyForm,
          defaultVatRate: Number(companyForm.defaultVatRate) || 20,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Firma bilgileri kaydedilemedi.");
        return;
      }

      setBundle((prev) => ({
        ...prev,
        company: data.data.company,
        settings: data.data.settings,
      }));
      setSuccess("Firma bilgileri kaydedildi.");
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function savePreferences(
    section: "invoice" | "cash-bank" | "notifications",
    payload: Record<string, unknown>
  ) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data: payload }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Ayarlar kaydedilemedi.");
        return;
      }

      setBundle((prev) => ({
        ...prev,
        settings: data.data.settings,
      }));
      setSuccess("Ayarlar kaydedildi.");
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  function selectSection(section: SettingsSection) {
    setActiveSection(section);
    setMobileMenuOpen(false);
    setError("");
    setSuccess("");
  }

  function renderSectionContent() {
    if (activeSection === "company") {
      return (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              {companyForm.logoUrl ? (
                <img
                  src={companyForm.logoUrl}
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="text-slate-400" size={28} />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f]">
                {logoUploading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <ImagePlus size={16} />
                )}
                Logo Yükle
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>

              {companyForm.logoUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    setCompanyForm((prev) => ({ ...prev, logoUrl: "" }))
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-[12px] font-black text-slate-600"
                >
                  <X size={16} />
                  Kaldır
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Firma Adı"
              value={companyForm.name}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, name: value }))
              }
            />
            <Field
              label="Telefon"
              icon={<Phone size={16} />}
              value={companyForm.phone}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, phone: value }))
              }
            />
            <Field
              label="E-posta"
              icon={<Mail size={16} />}
              value={companyForm.email}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, email: value }))
              }
            />
            <Field
              label="Vergi No"
              value={companyForm.taxNo}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, taxNo: value }))
              }
            />
            <Field
              label="Vergi Dairesi"
              value={companyForm.taxOffice}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, taxOffice: value }))
              }
            />
            <Field
              label="Para Birimi"
              value={companyForm.currency}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, currency: value }))
              }
              asSelect
              options={[
                { value: "TRY", label: "TRY · Türk Lirası" },
                { value: "USD", label: "USD · Amerikan Doları" },
                { value: "EUR", label: "EUR · Euro" },
              ]}
            />
            <Field
              label="Varsayılan KDV (%)"
              type="number"
              value={companyForm.defaultVatRate}
              onChange={(value) =>
                setCompanyForm((prev) => ({ ...prev, defaultVatRate: value }))
              }
            />
          </div>

          <Field
            label="Adres"
            icon={<MapPin size={16} />}
            value={companyForm.address}
            onChange={(value) =>
              setCompanyForm((prev) => ({ ...prev, address: value }))
            }
            multiline
          />

          <SaveButton saving={saving} onClick={saveCompany} />
        </div>
      );
    }

    if (activeSection === "users") {
      return (
        <div className="space-y-0">
          <TeamSettingsBanner />
          <SettingsUsersPanel />
        </div>
      );
    }

    if (activeSection === "invoice") {
      return (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Varsayılan Fatura Tipi"
              value={invoiceForm.defaultInvoiceType}
              onChange={(value) =>
                setInvoiceForm((prev) => ({
                  ...prev,
                  defaultInvoiceType: value as typeof prev.defaultInvoiceType,
                }))
              }
              asSelect
              options={[
                { value: "E_ARCHIVE", label: "e-Arşiv" },
                { value: "E_INVOICE", label: "e-Fatura" },
                { value: "NORMAL", label: "Normal Fatura" },
              ]}
            />
            <Field
              label="Fatura Numara Ön Eki"
              value={invoiceForm.invoiceNumberPrefix}
              onChange={(value) =>
                setInvoiceForm((prev) => ({
                  ...prev,
                  invoiceNumberPrefix: value,
                }))
              }
            />
            <Field
              label="Varsayılan Vade (Gün)"
              type="number"
              value={invoiceForm.defaultDueDays}
              onChange={(value) =>
                setInvoiceForm((prev) => ({ ...prev, defaultDueDays: value }))
              }
            />
            <Field
              label="Varsayılan KDV (%)"
              type="number"
              value={invoiceForm.defaultVatRate}
              onChange={(value) =>
                setInvoiceForm((prev) => ({ ...prev, defaultVatRate: value }))
              }
            />
          </div>

          <Field
            label="Fatura Not Şablonu"
            value={invoiceForm.invoiceNoteTemplate}
            onChange={(value) =>
              setInvoiceForm((prev) => ({
                ...prev,
                invoiceNoteTemplate: value,
              }))
            }
            multiline
            placeholder="Faturalarda otomatik görünecek not metni..."
          />

          <SaveButton
            saving={saving}
            onClick={() =>
              savePreferences("invoice", {
                ...invoiceForm,
                defaultDueDays: Number(invoiceForm.defaultDueDays) || 30,
                defaultVatRate: Number(invoiceForm.defaultVatRate) || 20,
              })
            }
          />
        </div>
      );
    }

    if (activeSection === "cash-bank") {
      return (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Varsayılan Tahsilat Hesabı"
              value={cashBankForm.defaultCollectionAccountId}
              onChange={(value) =>
                setCashBankForm((prev) => ({
                  ...prev,
                  defaultCollectionAccountId: value,
                }))
              }
              asSelect
              options={[
                { value: "", label: "Seçilmedi" },
                ...visibleAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.name} (${account.type})`,
                })),
              ]}
            />
            <Field
              label="Varsayılan Gider Hesabı"
              value={cashBankForm.defaultExpenseAccountId}
              onChange={(value) =>
                setCashBankForm((prev) => ({
                  ...prev,
                  defaultExpenseAccountId: value,
                }))
              }
              asSelect
              options={[
                { value: "", label: "Seçilmedi" },
                ...visibleAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.name} (${account.type})`,
                })),
              ]}
            />
          </div>

          <ToggleRow
            label="Otomatik Nakit Kasa oluştur"
            description="Tahsilat hesabı yoksa POS ve satışlarda otomatik oluşturulur."
            checked={cashBankForm.autoCreateCashAccount}
            onChange={(checked) =>
              setCashBankForm((prev) => ({
                ...prev,
                autoCreateCashAccount: checked,
              }))
            }
          />

          <ToggleRow
            label="Pasif hesapları gizle"
            description="Ayar ekranında ve seçim listelerinde pasif hesapları gösterme."
            checked={cashBankForm.hideInactiveAccounts}
            onChange={(checked) =>
              setCashBankForm((prev) => ({
                ...prev,
                hideInactiveAccounts: checked,
              }))
            }
          />

          <SaveButton
            saving={saving}
            onClick={() =>
              savePreferences("cash-bank", {
                ...cashBankForm,
                defaultCollectionAccountId:
                  cashBankForm.defaultCollectionAccountId || null,
                defaultExpenseAccountId:
                  cashBankForm.defaultExpenseAccountId || null,
              })
            }
          />
        </div>
      );
    }

    if (activeSection === "integrations") {
      return (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
          <p className="text-[14px] font-black text-[#0f1f4d]">
            Pazaryeri Entegrasyonları
          </p>
          <p className="mt-2 text-[12px] leading-6 text-slate-500">
            Trendyol bağlantısı, bağlantı testi ve manuel senkronizasyon ayarlarını
            yönetmek için Entegrasyonlar sayfasına gidin.
          </p>
          <Link
            href="/settings/integrations"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f]"
          >
            Entegrasyonlar Sayfasını Aç
          </Link>
        </div>
      );
    }

    if (activeSection === "notifications") {
      return (
        <div className="space-y-4">
          <ToggleRow
            label="Düşük stok uyarısı"
            description="Minimum stok altına düşen ürünler için bildirim."
            checked={notificationForm.notifyLowStock}
            onChange={(checked) =>
              setNotificationForm((prev) => ({
                ...prev,
                notifyLowStock: checked,
              }))
            }
          />
          <ToggleRow
            label="Vadesi gelen fatura uyarısı"
            description="Ödeme tarihi yaklaşan faturalar için hatırlatma."
            checked={notificationForm.notifyDueInvoices}
            onChange={(checked) =>
              setNotificationForm((prev) => ({
                ...prev,
                notifyDueInvoices: checked,
              }))
            }
          />
          <ToggleRow
            label="Geciken tahsilat uyarısı"
            description="Vadesi geçmiş alacaklar için uyarı."
            checked={notificationForm.notifyLateCollections}
            onChange={(checked) =>
              setNotificationForm((prev) => ({
                ...prev,
                notifyLateCollections: checked,
              }))
            }
          />
          <ToggleRow
            label="Günlük özet bildirimi"
            description="Her gün satış, tahsilat ve stok özeti."
            checked={notificationForm.notifyDailySummary}
            onChange={(checked) =>
              setNotificationForm((prev) => ({
                ...prev,
                notifyDailySummary: checked,
              }))
            }
          />
          <ToggleRow
            label="Çalışan ödeme hatırlatmaları"
            description="Vadesi yaklaşan personel ödemeleri için hatırlatma."
            checked={notificationForm.notifyEmployeePayments}
            onChange={(checked) =>
              setNotificationForm((prev) => ({
                ...prev,
                notifyEmployeePayments: checked,
              }))
            }
          />

          <SaveButton
            saving={saving}
            onClick={() => savePreferences("notifications", notificationForm)}
          />
        </div>
      );
    }

    if (activeSection === "data") {
      const exports = [
        { label: "Müşteri CSV", href: "/api/customers/export" },
        { label: "Ürün CSV", href: "/api/products/export" },
        { label: "Satış CSV", href: "/api/sales/export" },
        { label: "Fatura CSV", href: "/api/invoices/export" },
      ];

      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {exports.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white text-[12px] font-black text-[#0f1f4d] shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-700"
              >
                <Download size={16} />
                {item.label} İndir
              </a>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5">
            <p className="text-[13px] font-black text-[#0f1f4d]">Tüm veriyi indir</p>
            <p className="mt-2 text-[12px] leading-6 text-slate-500">
              Tam yedekleme paketi (müşteri, ürün, satış, fatura, gider) bir
              sonraki sürümde tek arşiv olarak sunulacaktır.
            </p>
          </div>
        </div>
      );
    }

    if (activeSection === "membership") {
      return (
        <div className="rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50 to-violet-50 p-5">
          <p className="text-[14px] font-black text-[#0f1f4d]">
            Üyelik ve ödeme yönetimi
          </p>
          <p className="mt-2 text-[12px] leading-6 text-slate-600">
            Aylık, 3 aylık, 6 aylık veya yıllık paket seçerek üyeliğinizi
            uzatabilir, ödeme geçmişinizi görüntüleyebilirsiniz.
          </p>
          <Link
            href="/settings/billing"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#0f1f4d] px-5 text-[12px] font-black text-white transition hover:bg-[#16285f]"
          >
            Üyelik ve Ödeme Sayfasına Git
          </Link>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TeamActionButton
          title="Firma Bilgileri"
          description="Logo, vergi ve iletişim"
          onClick={() => selectSection("company")}
          icon={<Building2 size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a]"
        />

        <ActionCard
          title="Entegrasyonlar"
          description="Pazaryeri bağlantıları"
          href="/settings/integrations"
          icon={<PlugZap size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-violet-500 to-purple-600"
        />

        {canManageSettings ? (
          <ActionCard
            title="Yapay Zekâ"
            description="Asistan ve model ayarları"
            href="/settings/ai"
            icon={<Sparkles size={22} strokeWidth={2.4} />}
            gradient="bg-linear-to-br from-indigo-500 to-violet-600"
          />
        ) : null}

        {canManageMembership ? (
          <ActionCard
            title="Üyelik & Ödeme"
            description="Paket ve faturalandırma"
            href="/settings/billing"
            icon={<CreditCard size={22} strokeWidth={2.4} />}
            gradient="bg-linear-to-br from-emerald-500 to-green-600"
          />
        ) : (
          <TeamActionButton
            title="Bildirimler"
            description="Uyarı tercihlerini düzenle"
            onClick={() => selectSection("notifications")}
            icon={<Bell size={22} strokeWidth={2.4} />}
            gradient="bg-linear-to-br from-orange-500 to-amber-600"
          />
        )}

        <ActionCard
          title="Çalışanlar"
          description="Personel ve ekip yönetimi"
          href="/team"
          icon={<Users size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-blue-500 to-blue-600"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Aktif Kullanıcı"
          value={formatNumber(activeUserCount)}
          subtitle={`${formatNumber(bundle.users.length)} toplam kullanıcı`}
          icon={<Users size={18} />}
          color="blue"
        />
        <StatCard
          title="Aktif Hesap"
          value={formatNumber(activeAccountCount)}
          subtitle="Kasa ve banka hesapları"
          icon={<Wallet size={18} />}
          color="green"
        />
        <StatCard
          title="Para Birimi"
          value={companyForm.currency}
          subtitle={`Varsayılan KDV %${companyForm.defaultVatRate}`}
          icon={<Building2 size={18} />}
          color="purple"
        />
        {canManageMembership ? (
          <StatCard
            title="Üyelik Durumu"
            value={bundle.membership.statusLabel}
            subtitle={
              bundle.membership.nextPaymentDate
                ? `Sonraki: ${formatShortDate(bundle.membership.nextPaymentDate)}`
                : "Ödeme bilgisi yok"
            }
            icon={<CreditCard size={18} />}
            color="orange"
            href="/settings/billing"
          />
        ) : (
          <StatCard
            title="Fatura Tipi"
            value={getInvoiceTypeLabel(bundle.settings.defaultInvoiceType)}
            subtitle={`Ön ek: ${bundle.settings.invoiceNumberPrefix}`}
            icon={<FileText size={18} />}
            color="orange"
          />
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left text-[13px] font-black text-[#0f1f4d] shadow-[0_8px_20px_rgba(15,23,42,0.04)] xl:hidden"
          >
            <span>{activeMenu.label}</span>
            <ChevronDown
              size={18}
              className={mobileMenuOpen ? "rotate-180 transition" : "transition"}
            />
          </button>

          <nav
            className={[
              "space-y-1 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_10px_28px_rgba(15,23,42,0.04)]",
              mobileMenuOpen ? "mt-3 block" : "mt-3 hidden xl:block",
              "xl:mt-0 xl:block",
            ].join(" ")}
          >
            {visibleMenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
                className={[
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  activeSection === item.id
                    ? "bg-[#0f1f4d] text-white shadow-[0_8px_20px_rgba(15,31,77,0.2)]"
                    : "text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    activeSection === item.id
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-black">{item.label}</span>
                  <span
                    className={[
                      "mt-0.5 block truncate text-[10px] font-medium",
                      activeSection === item.id
                        ? "text-white/70"
                        : "text-slate-400",
                    ].join(" ")}
                  >
                    {item.description}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                {activeMenu.icon}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-black text-[#0f1f4d]">
                  {activeMenu.label}
                </h2>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                  {activeMenu.description}
                </p>
                {activeSection === "invoice" ? (
                  <p className="mt-1 text-[11px] font-bold text-blue-600">
                    Aktif tip:{" "}
                    {getInvoiceTypeLabel(bundle.settings.defaultInvoiceType)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] font-semibold text-emerald-700">
                {success}
              </div>
            ) : null}

            {renderSectionContent()}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-[12px] font-extrabold text-[#24345f]/80">
              Firma Özeti
            </p>
            <p className="mt-1 truncate text-[14px] font-black text-[#0f1f4d]">
              {bundle.company.name}
            </p>

            <div className="mt-4 space-y-3">
              <SummaryRow
                label="Kullanıcı"
                value={formatNumber(bundle.users.length)}
              />
              <SummaryRow
                label="Hesap"
                value={formatNumber(bundle.accounts.length)}
              />
              <SummaryRow
                label="Bildirim"
                value={`${activeNotificationCount}/5 aktif`}
                tone="blue"
              />
              {canManageMembership && bundle.membership.amount != null ? (
                <SummaryRow
                  label="Son ödeme"
                  value={formatMoney(bundle.membership.amount)}
                  tone="emerald"
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a] p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]">
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <div>
                <p className="text-[13px] font-black">Güvenli ayar alanı</p>
                <p className="mt-2 text-[11px] leading-5 text-white/75">
                  Tüm ayarlar yalnızca oturum açtığınız firmaya özeldir. Başka
                  bir şirketin ayarlarına erişim engellenir.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SaveButton({
  saving,
  onClick,
}: {
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-5 text-[12px] font-black text-white transition hover:bg-[#16285f] disabled:opacity-50"
    >
      {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
      Kaydet
    </button>
  );
}

function SummaryRow({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "emerald";
}) {
  const valueClass =
    tone === "blue"
      ? "text-blue-600"
      : tone === "emerald"
        ? "text-emerald-600"
        : "text-[#0f1f4d]";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className={["text-[13px] font-black", valueClass].join(" ")}>
        {value}
      </span>
    </div>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.03)] transition hover:border-slate-300">
      <span>
        <span className="block text-[13px] font-black text-[#0f1f4d]">{label}</span>
        <span className="mt-1 block text-[12px] text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 rounded border-slate-300 text-[#0f1f4d] focus:ring-blue-200"
      />
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  icon,
  type = "text",
  multiline = false,
  asSelect = false,
  options = [],
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
  type?: string;
  multiline?: boolean;
  asSelect?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const inputClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-slate-500">
        {label}
      </span>
      {asSelect ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
      ) : (
        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </span>
          ) : null}
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={[inputClass, icon ? "pl-10" : ""].join(" ")}
          />
        </div>
      )}
    </label>
  );
}
