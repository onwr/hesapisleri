"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Package,
  Rocket,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  authFlatFormClassName,
  authInputClassName,
  authPrimaryButtonClassName,
  authPrimaryButtonInlineClassName,
} from "@/components/auth/auth-styles";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ONBOARDING_USAGE_AREAS } from "@/lib/onboarding/onboarding-schemas";
import { parseSafeInternalReturnTo } from "@/lib/onboarding/onboarding-routes";

const STEPS = [
  { id: 1, label: "Hoş geldiniz", icon: Sparkles },
  { id: 2, label: "Firma bilgileri", icon: Building2 },
  { id: 3, label: "Operasyon", icon: Settings2 },
  { id: 4, label: "İlk veriler", icon: Package },
  { id: 5, label: "Tamamla", icon: Rocket },
] as const;

const USAGE_LABELS: Record<(typeof ONBOARDING_USAGE_AREAS)[number], string> = {
  sales_pos: "Satış ve POS",
  products_stock: "Ürün ve stok",
  ecommerce: "E-ticaret",
  finance: "Finans",
  invoice: "Fatura",
  employees: "Çalışan yönetimi",
};

const VAT_OPTIONS = [0, 1, 8, 10, 18, 20] as const;

type OnboardingBundle = {
  state: {
    status: string;
    currentStep: number;
  };
  milestones: {
    productCount: number;
    customerCount: number;
    saleCount: number;
    stockMovementCount: number;
    integrationCount: number;
    teamMemberCount: number;
    hasDefaultWarehouse: boolean;
    hasDefaultCashAccount: boolean;
    companyProfileComplete: boolean;
  };
  supportEmail: string;
  canManage: boolean;
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  taxNo: string;
  taxOffice: string;
  address: string;
  currency: "TRY" | "USD" | "EUR";
  defaultVatRate: number;
};

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = Number(searchParams.get("step") ?? "1");

  const [step, setStep] = useState(
    Number.isFinite(initialStep) && initialStep >= 1 && initialStep <= 5
      ? initialStep
      : 1
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [bundle, setBundle] = useState<OnboardingBundle | null>(null);
  const [usageAreas, setUsageAreas] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    email: "",
    taxNo: "",
    taxOffice: "",
    address: "",
    currency: "TRY",
    defaultVatRate: 20,
  });

  const progressPercent = useMemo(
    () => Math.round((step / STEPS.length) * 100),
    [step]
  );

  const loadBundle = useCallback(async () => {
    const res = await fetch("/api/onboarding");
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message ?? "Onboarding yüklenemedi.");
    }
    return json.data as OnboardingBundle & {
      shouldRedirect?: boolean;
    };
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const data = await loadBundle();

        if (
          data.state.status === "COMPLETED" ||
          data.state.status === "DISMISSED"
        ) {
          router.replace("/dashboard");
          return;
        }

        setBundle(data);
        if (data.state.currentStep > 1) {
          setStep(data.state.currentStep);
        }

        const [meRes, settingsRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/settings"),
        ]);
        const meJson = await meRes.json();
        const settingsJson = await settingsRes.json();

        if (meJson.success && meJson.data?.company) {
          const company = meJson.data.company;
          setForm((prev) => ({
            ...prev,
            name: company.name ?? prev.name,
            phone: company.phone ?? "",
            email: company.email ?? meJson.data.user.email ?? "",
            taxNo: company.taxNo ?? "",
            taxOffice: company.taxOffice ?? "",
            address: company.address ?? "",
          }));
        }

        if (settingsJson.success && settingsJson.data) {
          const rawCurrency = settingsJson.data.company.currency;
          setForm((prev) => ({
            ...prev,
            currency:
              rawCurrency === "USD" || rawCurrency === "EUR"
                ? rawCurrency
                : "TRY",
            defaultVatRate:
              settingsJson.data.settings.defaultVatRate ?? prev.defaultVatRate,
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yükleme hatası.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [loadBundle, router]);

  async function persistStep(nextStep: number) {
    const res = await fetch("/api/onboarding/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStep: nextStep }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message ?? "Adım kaydedilemedi.");
    }
  }

  async function saveCompanyInfo() {
    if (form.name.trim().length < 2) {
      throw new Error("Firma adı en az 2 karakter olmalıdır.");
    }

    const res = await fetch("/api/settings/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message ?? "Firma bilgileri kaydedilemedi.");
    }
  }

  async function handleNext() {
    setSaving(true);
    setError("");
    try {
      if (step === 2 && bundle?.canManage) {
        await saveCompanyInfo();
      } else if (step === 2 && !bundle?.canManage) {
        // Sınırlı çalışan firma bilgisi adımını atlayabilir.
      }

      const nextStep = Math.min(step + 1, STEPS.length);
      await persistStep(nextStep);
      setStep(nextStep);
      const refreshed = await loadBundle();
      setBundle(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBack() {
    setStep((prev) => Math.max(1, prev - 1));
  }

  async function handleDismiss() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/dismiss", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "İşlem başarısız.");
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Tamamlanamadı.");
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setSaving(false);
    }
  }

  function toggleUsage(area: string) {
    setUsageAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  if (loading) {
    return <AppLoadingScreen preset="onboarding" />;
  }

  const milestones = bundle?.milestones;
  const productHref =
    parseSafeInternalReturnTo("/products/new?returnTo=/onboarding", {
      fallback: "/products/new",
    }) ?? "/products/new";
  const customerHref =
    parseSafeInternalReturnTo("/customers/new?returnTo=/onboarding", {
      fallback: "/customers/new",
    }) ?? "/customers/new";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-blue-600">
              Kurulum · Adım {step}/{STEPS.length}
            </p>
            <h1 className="text-2xl font-black tracking-tight text-[#0f1f4d] sm:text-3xl">
              Hesabınızı hazırlayın
            </h1>
          </div>
          {bundle?.canManage ? (
            <button
              type="button"
              onClick={() => void handleDismiss()}
              disabled={saving}
              className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            >
              Daha sonra devam et
            </button>
          ) : null}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-blue-600 to-violet-600 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="hidden gap-2 sm:grid sm:grid-cols-5">
          {STEPS.map((item) => {
            const Icon = item.icon;
            const active = item.id === step;
            const done = item.id < step;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border px-3 py-2 text-center ${
                  active
                    ? "border-blue-200 bg-blue-50"
                    : done
                      ? "border-emerald-100 bg-emerald-50/60"
                      : "border-slate-100 bg-white"
                }`}
              >
                <Icon
                  className={`mx-auto size-4 ${
                    active ? "text-blue-600" : done ? "text-emerald-600" : "text-slate-400"
                  }`}
                />
                <p className="mt-1 text-[11px] font-bold text-slate-600">{item.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {error ? <AuthAlert variant="error" message={error} /> : null}

      <div className={authFlatFormClassName}>
        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              Hangi alanları kullanacağınızı seçin. Bu tercih yalnızca kurulum
              yönlendirmesi içindir; plan veya yetkilerinizi etkilemez.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ONBOARDING_USAGE_AREAS.map((area) => {
                const selected = usageAreas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleUsage(area)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                      selected
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {USAGE_LABELS[area]}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Firma adı *</Label>
              <Input
                className={authInputClassName}
                value={form.name}
                disabled={!bundle?.canManage}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                className={authInputClassName}
                value={form.phone}
                disabled={!bundle?.canManage}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input
                className={authInputClassName}
                value={form.email}
                disabled={!bundle?.canManage}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Para birimi</Label>
              <Select
                value={form.currency}
                disabled={!bundle?.canManage}
                onValueChange={(value: "TRY" | "USD" | "EUR") =>
                  setForm((p) => ({ ...p, currency: value }))
                }
              >
                <SelectTrigger className={authInputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">TRY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Varsayılan KDV</Label>
              <Select
                value={String(form.defaultVatRate)}
                disabled={!bundle?.canManage}
                onValueChange={(value) =>
                  setForm((p) => ({ ...p, defaultVatRate: Number(value) }))
                }
              >
                <SelectTrigger className={authInputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_OPTIONS.map((rate) => (
                    <SelectItem key={rate} value={String(rate)}>
                      %{rate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Adres</Label>
              <Input
                className={authInputClassName}
                value={form.address}
                disabled={!bundle?.canManage}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Operasyon kayıtlarınız kontrol edildi:</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`size-4 ${
                    milestones?.hasDefaultWarehouse ? "text-emerald-500" : "text-slate-300"
                  }`}
                />
                Varsayılan depo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  className={`size-4 ${
                    milestones?.hasDefaultCashAccount ? "text-emerald-500" : "text-slate-300"
                  }`}
                />
                Kasa hesabı
              </li>
            </ul>
            <p className="text-xs text-slate-500">
              Eksik kayıtlar otomatik oluşturulur; mevcut kayıtlar tekrarlanmaz.
            </p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              İlk verilerinizi ekleyebilir veya bu adımı atlayabilirsiniz.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href={productHref}
                className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <Package className="size-5 text-blue-600" />
                <p className="mt-2 font-bold text-[#0f1f4d]">İlk ürününü ekle</p>
                <p className="mt-1 text-xs text-slate-500">
                  Ürün formuna yönlendirilirsiniz.
                </p>
              </Link>
              <Link
                href={customerHref}
                className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <Users className="size-5 text-blue-600" />
                <p className="mt-2 font-bold text-[#0f1f4d]">Müşteri oluştur</p>
                <p className="mt-1 text-xs text-slate-500">
                  Müşteri formuna yönlendirilirsiniz.
                </p>
              </Link>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Gerçek ilerlemeniz:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Ürün", milestones?.productCount ?? 0],
                ["Müşteri", milestones?.customerCount ?? 0],
                ["Satış", milestones?.saleCount ?? 0],
                ["Stok hareketi", milestones?.stockMovementCount ?? 0],
                ["Entegrasyon", milestones?.integrationCount ?? 0],
                ["Ekip üyesi", milestones?.teamMemberCount ?? 0],
              ].map(([label, count]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm"
                >
                  <span className="font-bold text-[#0f1f4d]">{label}</span>
                  <span className="ml-2 text-slate-500">{count}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/pos"
                className="inline-flex h-10 items-center rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white"
              >
                İlk Satışını Yap
              </Link>
              <Link
                href="/products"
                className="inline-flex h-10 items-center rounded-2xl border border-slate-200 px-4 text-sm font-bold text-[#0f1f4d]"
              >
                Ürünlerini Yönet
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500">
          Yardım:{" "}
          <a
            href={`mailto:${bundle?.supportEmail ?? ""}`}
            className="font-semibold text-blue-600"
          >
            {bundle?.supportEmail}
          </a>
        </div>

        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              className={authPrimaryButtonInlineClassName}
              onClick={() => void handleBack()}
              disabled={saving}
            >
              <ArrowLeft className="size-4" />
              Geri
            </Button>
          ) : null}

          {step < STEPS.length ? (
            <Button
              type="button"
              className={authPrimaryButtonClassName}
              onClick={() => void handleNext()}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              İleri
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className={authPrimaryButtonClassName}
              onClick={() => void handleComplete()}
              disabled={saving}
            >
              Panele Git
              <Rocket className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
