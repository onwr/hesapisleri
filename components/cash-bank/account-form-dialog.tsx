"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRODUCT_INPUT_CLASS } from "@/components/products/product-ui-tokens";
import {
  ACCOUNT_TYPES,
  accountShowsBankFields,
  getAccountTypeLabel,
} from "@/lib/account-utils";

export type AccountFormValues = {
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  bankName: string;
  branchName: string;
  iban: string;
  accountNumber: string;
  currency: string;
  openingBalance: string;
  isDefault: boolean;
  description: string;
  status: "ACTIVE" | "PASSIVE";
};

export type AccountFormRecord = {
  id: string;
  name: string;
  type: string;
  bankName: string | null;
  branchName: string | null;
  iban: string | null;
  accountNumber: string | null;
  currency: string;
  isDefault: boolean;
  description: string | null;
  status: "ACTIVE" | "PASSIVE";
};

type AccountFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  mode: "create" | "edit";
  account?: AccountFormRecord | null;
  canManage?: boolean;
};

const ACCOUNT_API = "/api/cash-bank/accounts";

function emptyForm(): AccountFormValues {
  return {
    name: "",
    type: "CASH",
    bankName: "",
    branchName: "",
    iban: "",
    accountNumber: "",
    currency: "TRY",
    openingBalance: "0",
    isDefault: false,
    description: "",
    status: "ACTIVE",
  };
}

function fromAccount(account: AccountFormRecord): AccountFormValues {
  return {
    name: account.name,
    type: (ACCOUNT_TYPES.includes(account.type as (typeof ACCOUNT_TYPES)[number])
      ? account.type
      : "OTHER") as AccountFormValues["type"],
    bankName: account.bankName ?? "",
    branchName: account.branchName ?? "",
    iban: account.iban ?? "",
    accountNumber: account.accountNumber ?? "",
    currency: account.currency || "TRY",
    openingBalance: "0",
    isDefault: account.isDefault,
    description: account.description ?? "",
    status: account.status,
  };
}

export function AccountFormDialog({
  open,
  onClose,
  onSuccess,
  mode,
  account,
  canManage = true,
}: AccountFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<AccountFormValues>(emptyForm);

  useEffect(() => {
    if (!open) return;

    setError("");
    setForm(mode === "edit" && account ? fromAccount(account) : emptyForm());
  }, [open, mode, account]);

  const showBankFields = useMemo(
    () => accountShowsBankFields(form.type),
    [form.type]
  );

  const showBankNameOptional = form.type === "POS" || form.type === "CREDIT_CARD";

  function updateField<K extends keyof AccountFormValues>(
    key: K,
    value: AccountFormValues[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) return;

    const name = form.name.trim();
    if (!name) {
      setError("Hesap adı zorunludur.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload =
        mode === "create"
          ? {
              name,
              type: form.type,
              bankName: form.bankName.trim() || undefined,
              branchName: form.branchName.trim() || undefined,
              iban: form.iban.trim() || undefined,
              accountNumber: form.accountNumber.trim() || undefined,
              currency: form.currency.trim() || "TRY",
              openingBalance: Number(form.openingBalance) || 0,
              isDefault: form.isDefault,
              description: form.description.trim() || undefined,
            }
          : {
              name,
              type: form.type,
              bankName: form.bankName.trim() || null,
              branchName: form.branchName.trim() || null,
              iban: form.iban.trim() || null,
              accountNumber: form.accountNumber.trim() || null,
              currency: form.currency.trim() || "TRY",
              isDefault: form.isDefault,
              description: form.description.trim() || null,
              status: form.status,
            };

      const response = await fetch(
        mode === "create" ? ACCOUNT_API : `${ACCOUNT_API}/${account?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Hesap kaydedilemedi.");
        return;
      }

      onSuccess(data.message || (mode === "create" ? "Hesap oluşturuldu." : "Hesap güncellendi."));
      onClose();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Yeni Hesap" : "Hesabı Düzenle"}
          </DialogTitle>
          <DialogDescription>
            Kasa, banka, POS veya kredi kartı hesabı oluşturun.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Hesap adı" required>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className={PRODUCT_INPUT_CLASS}
              placeholder="Örn: Merkez Kasa"
              disabled={!canManage}
            />
          </Field>

          <Field label="Hesap tipi" required>
            <select
              value={form.type}
              onChange={(event) =>
                updateField("type", event.target.value as AccountFormValues["type"])
              }
              className={PRODUCT_INPUT_CLASS}
              disabled={!canManage}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {getAccountTypeLabel(type)}
                </option>
              ))}
            </select>
          </Field>

          {(showBankFields || showBankNameOptional) && (
            <Field
              label="Banka adı"
              required={form.type === "BANK"}
            >
              <input
                value={form.bankName}
                onChange={(event) => updateField("bankName", event.target.value)}
                className={PRODUCT_INPUT_CLASS}
                placeholder="Örn: Garanti BBVA"
                disabled={!canManage}
              />
            </Field>
          )}

          {showBankFields && (
            <>
              <Field label="Şube">
                <input
                  value={form.branchName}
                  onChange={(event) => updateField("branchName", event.target.value)}
                  className={PRODUCT_INPUT_CLASS}
                  disabled={!canManage}
                />
              </Field>

              <Field label="IBAN">
                <input
                  value={form.iban}
                  onChange={(event) => updateField("iban", event.target.value)}
                  className={PRODUCT_INPUT_CLASS}
                  placeholder="TR..."
                  disabled={!canManage}
                />
              </Field>

              <Field label="Hesap No">
                <input
                  value={form.accountNumber}
                  onChange={(event) =>
                    updateField("accountNumber", event.target.value)
                  }
                  className={PRODUCT_INPUT_CLASS}
                  disabled={!canManage}
                />
              </Field>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Para birimi">
              <input
                value={form.currency}
                onChange={(event) => updateField("currency", event.target.value)}
                className={PRODUCT_INPUT_CLASS}
                disabled={!canManage}
              />
            </Field>

            {mode === "create" ? (
              <Field label="Açılış bakiyesi">
                <input
                  type="number"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={(event) =>
                    updateField("openingBalance", event.target.value)
                  }
                  className={PRODUCT_INPUT_CLASS}
                  disabled={!canManage}
                />
              </Field>
            ) : (
              <Field label="Durum">
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target.value as AccountFormValues["status"]
                    )
                  }
                  className={PRODUCT_INPUT_CLASS}
                  disabled={!canManage}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="PASSIVE">Pasif</option>
                </select>
              </Field>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-[#24345f]">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => updateField("isDefault", event.target.checked)}
              disabled={!canManage}
            />
            Varsayılan hesap yap
          </label>

          <Field label="Açıklama">
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              className={`${PRODUCT_INPUT_CLASS} min-h-20`}
              disabled={!canManage}
            />
          </Field>

          {error ? (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving || !canManage}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : mode === "create" ? (
                "Hesap Oluştur"
              ) : (
                "Kaydet"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}
