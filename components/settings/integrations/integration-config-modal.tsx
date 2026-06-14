"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Wifi } from "lucide-react";
import type { IntegrationSummary } from "@/lib/marketplace/marketplace-integration-service";
import type { MarketplaceChannelKey } from "@/lib/marketplace/marketplace-types";
import { IntegrationChannelLogo } from "@/components/settings/integrations/integration-channel-logo";
import { IntegrationFieldHint } from "@/components/settings/integrations/integration-field-hint";
import { IntegrationSecretInput } from "@/components/settings/integrations/integration-secret-input";
import { CHANNEL_UI_CONFIG } from "@/components/settings/integrations/integration-ui-config";

type IntegrationConfigModalProps = {
  channel: MarketplaceChannelKey;
  integration: IntegrationSummary | null;
  warehouses: Array<{ id: string; name: string }>;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function IntegrationConfigModal({
  channel,
  integration,
  warehouses,
  open,
  onClose,
  onSaved,
}: IntegrationConfigModalProps) {
  const config = CHANNEL_UI_CONFIG[channel];
  const isTrendyol = channel === "TRENDYOL";

  const [supplierId, setSupplierId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [password, setPassword] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [interval, setInterval] = useState("15");
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(integration?.supplierId ?? "");
    setMerchantId(integration?.merchantId ?? "");
    setUsername(integration?.serviceUsername ?? "");
    setApiKey("");
    setApiSecret("");
    setPassword("");
    setSyncEnabled(integration?.syncEnabled ?? false);
    setInterval(String(integration?.autoSyncIntervalMinutes ?? 15));
    setDefaultWarehouseId(integration?.defaultWarehouseId ?? "");
    setError(null);
  }, [open, integration]);

  if (!open) return null;

  const mustReenterSecrets = isTrendyol && integration?.status === "ERROR";
  const hasStoredCredentials = integration?.hasCredentials ?? false;
  const trendyolKeyLabel = mustReenterSecrets
    ? "yeniden girin"
    : hasStoredCredentials
      ? "kayıtlı"
      : "yeni";
  const trendyolSecretLabel = trendyolKeyLabel;
  const showTrendyolKeyBadge =
    hasStoredCredentials && !mustReenterSecrets ? "API Key kayıtlı" : null;
  const showTrendyolSecretBadge =
    hasStoredCredentials && !mustReenterSecrets ? "API Secret kayıtlı" : null;
  const showHbPasswordBadge =
    hasStoredCredentials && !mustReenterSecrets ? "API Şifresi kayıtlı" : null;

  function buildSaveBody() {
    if (isTrendyol) {
      return {
        supplierId,
        apiKey: apiKey || undefined,
        apiSecret: apiSecret || undefined,
        syncEnabled,
        autoSyncIntervalMinutes: Number(interval) || 15,
        defaultWarehouseId: defaultWarehouseId || null,
      };
    }
    return {
      merchantId,
      username: username || undefined,
      password: password || undefined,
      syncEnabled,
      autoSyncIntervalMinutes: Number(interval) || 15,
      defaultWarehouseId: defaultWarehouseId || null,
    };
  }

  async function save(andTest: boolean) {
    setError(null);

    if (isTrendyol) {
      const mustRefreshSecrets =
        !integration?.hasCredentials || integration?.status === "ERROR";
      if (mustRefreshSecrets && (!apiKey.trim() || !apiSecret.trim())) {
        setError(
          "Trendyol API Key ve API Secret alanlarını Trendyol panelinden yeniden girin. Boş bırakırsanız eski (hatalı) kayıt korunur."
        );
        return;
      }
      if (!supplierId.trim()) {
        setError("Satıcı ID (Cari ID) zorunludur.");
        return;
      }
    }

    if (andTest) setTesting(true);
    else setSaving(true);
    try {
      const response = await fetch(`/api/integrations/${channel}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSaveBody()),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          result.error ?? result.message ?? result.test?.message ?? "Kaydetme başarısız."
        );
      }
      setApiKey("");
      setApiSecret("");
      setPassword("");
      await onSaved();

      if (andTest) {
        await onSaved();
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydetme başarısız.");
    } finally {
      setSaving(false);
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <IntegrationChannelLogo channel={channel} size="md" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-600">
                Bağlantı Yapılandırması
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-950">{config.title}</h3>
              <p className="mt-1 text-sm text-slate-500">
                API bilgilerinizi güvenli şekilde kaydedin. Bağlantı hatası varsa API
                Key ve Secret alanlarını panelden yeniden girin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
          >
            Kapat
          </button>
        </div>

        {isTrendyol ? (
          <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/70 p-4 text-xs leading-6 text-orange-950">
            <p className="font-black">Trendyol panelinde hangi alan nereye girilir?</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                <strong>Satıcı ID (Cari ID)</strong> → Supplier ID alanına (ör. 649347)
              </li>
              <li>
                <strong>API Key</strong> → API Key alanına
              </li>
              <li>
                <strong>API Secret</strong> → API Secret alanına
              </li>
              <li>
                <strong>Entegrasyon Referans Kodu</strong> ve <strong>Token</strong>{" "}
                kullanılmaz — Token, Key+Secret birleşimidir; ayrı ayrı girin.
              </li>
            </ul>
            {integration?.status === "ERROR" ? (
              <p className="mt-2 font-semibold text-rose-700">
                Son hata: {integration.lastError ?? "API bilgileri doğrulanamadı."}{" "}
                Lütfen API Key ve Secret alanlarını yeniden doldurup Kaydet ve Test Et
                kullanın.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {isTrendyol ? (
            <>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-slate-600">
                  Satıcı ID (Cari ID)
                </span>
                <input
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
                  placeholder="649347"
                />
                <IntegrationFieldHint text="Trendyol panelinizdeki satıcı numarasıdır. API URL’sinde kullanılır. Entegrasyon Referans Kodu veya Token değildir." />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-600">
                  API Key ({trendyolKeyLabel})
                </span>
                <IntegrationSecretInput
                  value={apiKey}
                  onChange={setApiKey}
                  placeholder={hasStoredCredentials ? "••••••••" : "apikey"}
                  savedBadge={showTrendyolKeyBadge}
                />
                <IntegrationFieldHint text="Trendyol API erişimi için kullanılır. API Secret ile birlikte Basic Auth oluşturur." />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-600">
                  API Secret ({trendyolSecretLabel})
                </span>
                <IntegrationSecretInput
                  value={apiSecret}
                  onChange={setApiSecret}
                  placeholder={hasStoredCredentials ? "••••••••" : "secret"}
                  savedBadge={showTrendyolSecretBadge}
                />
                <IntegrationFieldHint text="Trendyol API Key ile birlikte kullanılan gizli anahtardır. Güvenlik nedeniyle kaydedildikten sonra tekrar gösterilmez." />
              </label>
            </>
          ) : (
            <>
              <label className="block sm:col-span-2">
                <span className="text-xs font-bold text-slate-600">Merchant ID</span>
                <input
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
                  placeholder="merchant-id"
                />
                <IntegrationFieldHint text="Hepsiburada satıcı kimliğiniz. API isteklerinde mağazanızı tanımlamak için kullanılır." />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-600">
                  Kullanıcı Adı (opsiyonel)
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
                  placeholder="servis-kullanici"
                />
                <IntegrationFieldHint text="Hepsiburada servis kullanıcı adı. Hesabınızda tanımlı değilse boş bırakabilirsiniz." />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-600">
                  API Şifresi ({hasStoredCredentials ? "kayıtlı" : "yeni"})
                </span>
                <IntegrationSecretInput
                  value={password}
                  onChange={setPassword}
                  placeholder={hasStoredCredentials ? "••••••••" : "secret"}
                  savedBadge={showHbPasswordBadge}
                />
                <IntegrationFieldHint text="Hepsiburada API erişim şifresi. Güvenlik nedeniyle kaydedildikten sonra tekrar gösterilmez." />
              </label>
            </>
          )}

          <label className="block sm:col-span-2">
            <span className="text-xs font-bold text-slate-600">Varsayılan Depo</span>
            <select
              value={defaultWarehouseId}
              onChange={(e) => setDefaultWarehouseId(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
            >
              <option value="">Varsayılan depo</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <IntegrationFieldHint text="Sipariş onaylandığında stok hareketinin hangi depodan yapılacağını belirler. Sync sırasında stok düşmez." />
          </label>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3">
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
              />
              <span className="text-sm font-semibold text-slate-700">
                Otomatik senkronizasyon
              </span>
            </label>
            <IntegrationFieldHint
              className="px-1"
              text="Açıksa cron endpoint’i üzerinden belirli aralıklarla siparişler otomatik çekilir."
            />
          </div>

          <label className="block sm:col-span-2">
            <span className="text-xs font-bold text-slate-600">Interval (dk)</span>
            <input
              type="number"
              min={5}
              max={240}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
            />
            <IntegrationFieldHint text="Otomatik senkronizasyonun kaç dakikada bir çalışacağını belirler." />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={saving || testing}
            onClick={() => save(false)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Kaydet
          </button>
          <button
            type="button"
            disabled={saving || testing}
            onClick={() => save(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            Kaydet ve Test Et
          </button>
        </div>
      </div>
    </div>
  );
}
