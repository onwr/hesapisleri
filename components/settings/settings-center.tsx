"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  PlugZap,
  CreditCard,
  Database,
  FileText,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { SettingsUsersPanel } from "@/components/settings/settings-users-panel";
import { TeamSettingsBanner } from "@/components/settings/team-settings-banner";
import type { SerializedSettingsBundle } from "@/lib/settings-service";
import { formatMoney } from "@/lib/format-utils";
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
    label: "Üyelik",
    description: "Ödeme ve plan",
    icon: <CreditCard size={18} />,
  },
];

type SettingsCenterProps = {
  initialData: SerializedSettingsBundle;
  canManageUsers?: boolean;
  canManageSettings?: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

export function SettingsCenter({
  initialData,
  canManageUsers = false,
  canManageSettings = true,
}: SettingsCenterProps) {
  const visibleMenuItems = useMemo(() => {
    return MENU_ITEMS.filter((item) => {
      if (item.id === "users") return canManageUsers;
      if (
        !canManageSettings &&
        (item.id === "invoice" || item.id === "cash-bank")
      ) {
        return false;
      }
      return true;
    });
  }, [canManageUsers, canManageSettings]);

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
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white">
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
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600"
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
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-black text-slate-950">Pazaryeri Entegrasyonları</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Trendyol bağlantısı, bağlantı testi ve manuel senkronizasyon ayarlarını
            yönetmek için Entegrasyonlar sayfasına gidin.
          </p>
          <a
            href="/settings/integrations"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white"
          >
            Entegrasyonlar Sayfasını Aç
          </a>
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
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {exports.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex h-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {item.label} İndir
              </a>
            ))}
          </div>

          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5">
            <p className="font-black text-slate-950">Tüm veriyi indir</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tam yedekleme paketi (müşteri, ürün, satış, fatura, gider) bir
              sonraki sürümde tek arşiv olarak sunulacaktır.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard
            label="Üyelik Durumu"
            value={bundle.membership.statusLabel}
          />
          <InfoCard
            label="Son Ödeme"
            value={
              bundle.membership.amount
                ? `${formatMoney(bundle.membership.amount)} · ${formatDate(bundle.membership.lastPaymentDate)}`
                : "Henüz ödeme kaydı yok"
            }
          />
          <InfoCard
            label="Sonraki Ödeme"
            value={formatDate(bundle.membership.nextPaymentDate)}
          />
          <InfoCard label="Paket Sistemi" value="Yok · Tek sürüm" />
        </div>

        <div className="rounded-3xl border border-dashed border-green-200 bg-green-50 p-5">
          <p className="font-black text-slate-950">Ödeme geçmişi</p>
          <p className="mt-2 text-sm leading-6 text-green-700">
            Üyelik ödeme geçmişi ve fatura indirme özelliği yakında bu bölümden
            yönetilebilecek.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-black text-slate-950">Ayarlar Merkezi</h1>
        <p className="mt-2 text-slate-500">
          Firma, kullanıcı, fatura, kasa ve sistem tercihlerinizi tek yerden
          yönetin.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left font-black text-slate-950 xl:hidden"
          >
            <span>{activeMenu.label}</span>
            <ChevronDown
              size={18}
              className={mobileMenuOpen ? "rotate-180 transition" : "transition"}
            />
          </button>

          <nav
            className={[
              "space-y-2 rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm",
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
                  "flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition",
                  activeSection === item.id
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl",
                    activeSection === item.id
                      ? "bg-white/10 text-white"
                      : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {item.icon}
                </span>
                <span>
                  <span className="block text-sm font-black">{item.label}</span>
                  <span
                    className={[
                      "mt-0.5 block text-xs",
                      activeSection === item.id
                        ? "text-slate-300"
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

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="mb-6 flex items-start gap-4 border-b border-slate-100 pb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              {activeMenu.icon}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                {activeMenu.label}
              </h2>
              <p className="text-sm text-slate-500">{activeMenu.description}</p>
              {activeSection === "invoice" ? (
                <p className="mt-1 text-xs font-semibold text-blue-600">
                  Aktif tip:{" "}
                  {getInvoiceTypeLabel(bundle.settings.defaultInvoiceType)}
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              {success}
            </div>
          ) : null}

          {renderSectionContent()}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="text-green-600" size={22} />
          <p className="text-sm leading-6 text-slate-500">
            Tüm ayarlar yalnızca oturum açtığınız firmaya özeldir. Başka bir
            şirketin ayarlarına erişim engellenir.
          </p>
        </div>
      </section>
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
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
    >
      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
      Kaydet
    </button>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-black text-slate-950">{value}</p>
    </div>
  );
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
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <span>
        <span className="block font-black text-slate-950">{label}</span>
        <span className="mt-1 block text-sm text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
    "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
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
          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      ) : (
        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </span>
          ) : null}
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={[inputClass, icon ? "pl-11" : ""].join(" ")}
          />
        </div>
      )}
    </label>
  );
}
