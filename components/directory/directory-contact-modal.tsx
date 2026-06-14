"use client";

import { useState } from "react";
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
import type { DirectoryContactType } from "@prisma/client";
import type { DirectoryContactRow } from "@/lib/directory-utils";

export type DirectoryContactFormValues = {
  type: DirectoryContactType;
  name: string;
  companyName: string;
  title: string;
  department: string;
  phone: string;
  mobilePhone: string;
  email: string;
  website: string;
  city: string;
  district: string;
  address: string;
  tags: string;
  notes: string;
  isFavorite: boolean;
};

const TYPE_OPTIONS: { value: DirectoryContactType; label: string }[] = [
  { value: "PERSON", label: "Kişi" },
  { value: "COMPANY", label: "Firma" },
  { value: "OTHER", label: "Diğer" },
];

function emptyForm(): DirectoryContactFormValues {
  return {
    type: "PERSON",
    name: "",
    companyName: "",
    title: "",
    department: "",
    phone: "",
    mobilePhone: "",
    email: "",
    website: "",
    city: "",
    district: "",
    address: "",
    tags: "",
    notes: "",
    isFavorite: false,
  };
}

function fromContact(contact: DirectoryContactRow): DirectoryContactFormValues {
  return {
    type: contact.type === "CUSTOMER" || contact.type === "EMPLOYEE"
      ? "PERSON"
      : contact.type,
    name: contact.name,
    companyName: contact.companyName ?? "",
    title: contact.title ?? "",
    department: contact.department ?? "",
    phone: contact.phone ?? "",
    mobilePhone: contact.mobilePhone ?? "",
    email: contact.email ?? "",
    website: contact.website ?? "",
    city: contact.city ?? "",
    district: contact.district ?? "",
    address: contact.address ?? "",
    tags: contact.tags.join(", "),
    notes: contact.notes ?? "",
    isFavorite: contact.isFavorite,
  };
}

type DirectoryContactModalProps = {
  open: boolean;
  contact?: DirectoryContactRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export function DirectoryContactModal({
  open,
  contact,
  onClose,
  onSaved,
}: DirectoryContactModalProps) {
  const [form, setForm] = useState<DirectoryContactFormValues>(
    contact ? fromContact(contact) : emptyForm()
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isEdit = Boolean(contact);

  function resetForm(nextContact?: DirectoryContactRow | null) {
    setForm(nextContact ? fromContact(nextContact) : emptyForm());
    setError(null);
  }

  function updateField<K extends keyof DirectoryContactFormValues>(
    key: K,
    value: DirectoryContactFormValues[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const payload = {
        type: form.type,
        name: form.name,
        companyName: form.companyName || null,
        title: form.title || null,
        department: form.department || null,
        phone: form.phone || null,
        mobilePhone: form.mobilePhone || null,
        email: form.email || null,
        website: form.website || null,
        city: form.city || null,
        district: form.district || null,
        address: form.address || null,
        notes: form.notes || null,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        isFavorite: form.isFavorite,
      };

      const response = await fetch(
        isEdit ? `/api/directory/${contact!.id}` : "/api/directory",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Kayıt kaydedilemedi.");
      }

      onSaved();
      onClose();
      resetForm();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Kayıt kaydedilemedi."
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
          resetForm(contact);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-[#0f1f4d]">
            {isEdit ? "Kişiyi Düzenle" : "Kişi Ekle"}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500">
            Fihriste manuel kişi veya firma kaydı ekleyin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kayıt Tipi">
              <select
                className={PRODUCT_INPUT_CLASS}
                value={form.type}
                onChange={(event) =>
                  updateField("type", event.target.value as DirectoryContactType)
                }
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ad Soyad">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Ad soyad"
              />
            </Field>
            <Field label="Firma Adı">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.companyName}
                onChange={(event) =>
                  updateField("companyName", event.target.value)
                }
                placeholder="Firma adı"
              />
            </Field>
            <Field label="Ünvan">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
            </Field>
            <Field label="Departman">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.department}
                onChange={(event) =>
                  updateField("department", event.target.value)
                }
              />
            </Field>
            <Field label="Telefon">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </Field>
            <Field label="Cep Telefonu">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.mobilePhone}
                onChange={(event) =>
                  updateField("mobilePhone", event.target.value)
                }
              />
            </Field>
            <Field label="E-Posta">
              <input
                type="email"
                className={PRODUCT_INPUT_CLASS}
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </Field>
            <Field label="Web Sitesi">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.website}
                onChange={(event) => updateField("website", event.target.value)}
              />
            </Field>
            <Field label="İl">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
              />
            </Field>
            <Field label="İlçe">
              <input
                className={PRODUCT_INPUT_CLASS}
                value={form.district}
                onChange={(event) => updateField("district", event.target.value)}
              />
            </Field>
          </div>

          <Field label="Adres">
            <textarea
              className={`${PRODUCT_INPUT_CLASS} min-h-[72px] py-2`}
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
            />
          </Field>

          <Field label="Etiketler">
            <input
              className={PRODUCT_INPUT_CLASS}
              value={form.tags}
              onChange={(event) => updateField("tags", event.target.value)}
              placeholder="Virgülle ayırın"
            />
          </Field>

          <Field label="Notlar">
            <textarea
              className={`${PRODUCT_INPUT_CLASS} min-h-[72px] py-2`}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-[13px] font-semibold text-[#0f1f4d]">
            <input
              type="checkbox"
              checked={form.isFavorite}
              onChange={(event) =>
                updateField("isFavorite", event.target.checked)
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Favorilere ekle
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kaydediliyor
                </>
              ) : isEdit ? (
                "Güncelle"
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
