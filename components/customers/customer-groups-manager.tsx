"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Edit3,
  Loader2,
  Plus,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import type { CustomerGroupWithStats } from "@/lib/customer-group-service";
import {
  CUSTOMER_GROUP_COLORS,
  DEFAULT_GROUP_NAME,
  getGroupColorClass,
  type CustomerGroupColor,
} from "@/lib/customer-group-utils";
import { formatCustomerMoney } from "@/lib/customers-page-utils";

type CustomerGroupsManagerProps = {
  groups: CustomerGroupWithStats[];
  summary: {
    totalGroups: number;
    totalCustomers: number;
    debtorCount: number;
    totalDebt: number;
    totalCredit: number;
  };
};

type GroupFormState = {
  name: string;
  color: CustomerGroupColor;
  note: string;
};

const emptyForm: GroupFormState = {
  name: "",
  color: "blue",
  note: "",
};

export function CustomerGroupsManager({
  groups,
  summary,
}: CustomerGroupsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "delete" | null>(
    null
  );
  const [selectedGroup, setSelectedGroup] = useState<CustomerGroupWithStats | null>(
    null
  );
  const [form, setForm] = useState<GroupFormState>(emptyForm);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr-TR")),
    [groups]
  );

  function openCreateModal() {
    setSelectedGroup(null);
    setForm(emptyForm);
    setError(null);
    setModalMode("create");
  }

  function openEditModal(group: CustomerGroupWithStats) {
    setSelectedGroup(group);
    setForm({
      name: group.name,
      color: (group.color as CustomerGroupColor) || "blue",
      note: group.note || "",
    });
    setError(null);
    setModalMode("edit");
  }

  function openDeleteModal(group: CustomerGroupWithStats) {
    setSelectedGroup(group);
    setError(null);
    setModalMode("delete");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedGroup(null);
    setError(null);
  }

  async function handleCreate() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/customers/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) {
          setError(result.message ?? "Grup oluşturulamadı.");
          return;
        }

        closeModal();
        router.refresh();
      } catch {
        setError("Grup oluşturulurken bir hata oluştu.");
      }
    });
  }

  async function handleUpdate() {
    if (!selectedGroup) return;

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/customers/groups/${selectedGroup.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) {
          setError(result.message ?? "Grup güncellenemedi.");
          return;
        }

        closeModal();
        router.refresh();
      } catch {
        setError("Grup güncellenirken bir hata oluştu.");
      }
    });
  }

  async function handleDelete() {
    if (!selectedGroup) return;

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/customers/groups/${selectedGroup.id}`, {
          method: "DELETE",
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) {
          setError(result.message ?? "Grup silinemedi.");
          return;
        }

        closeModal();
        router.refresh();
      } catch {
        setError("Grup silinirken bir hata oluştu.");
      }
    });
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            title: "Toplam Grup",
            value: String(summary.totalGroups),
            icon: Users,
            color: "bg-blue-50 text-blue-600",
          },
          {
            title: "Toplam Müşteri",
            value: String(summary.totalCustomers),
            icon: Users,
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            title: "Borçlu Müşteri",
            value: String(summary.debtorCount),
            icon: Users,
            color: "bg-orange-50 text-orange-600",
          },
          {
            title: "Toplam Borç",
            value: formatCustomerMoney(summary.totalDebt),
            icon: Wallet,
            color: "bg-rose-50 text-rose-600",
          },
          {
            title: "Toplam Alacak",
            value: formatCustomerMoney(summary.totalCredit),
            icon: Wallet,
            color: "bg-emerald-50 text-emerald-600",
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#24345f]/80">
                    {stat.title}
                  </p>
                  <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                    {stat.value}
                  </p>
                </div>

                <div
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    stat.color,
                  ].join(" ")}
                >
                  <Icon size={22} strokeWidth={2.4} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {sortedGroups.map((group) => (
            <article
              key={group.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span
                    className={[
                      "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
                      getGroupColorClass(group.color),
                    ].join(" ")}
                  >
                    {group.name}
                  </span>

                  <p className="mt-3 text-[24px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                    {group.customerCount}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    müşteri
                  </p>
                </div>

                <div className="text-right text-[11px] font-semibold text-slate-500">
                  <p>Aktif: {group.activeCustomerCount}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Toplam Borç</span>
                  <span className="font-black text-rose-500">
                    {formatCustomerMoney(group.totalDebt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Toplam Alacak</span>
                  <span className="font-black text-emerald-600">
                    {formatCustomerMoney(group.totalCredit)}
                  </span>
                </div>
              </div>

              {group.note ? (
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  {group.note}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/customers?group=${encodeURIComponent(group.name)}`}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-[11px] font-black text-white transition hover:bg-blue-700"
                >
                  Müşterileri Gör
                </Link>

                <button
                  type="button"
                  onClick={() => openEditModal(group)}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#24345f] transition hover:bg-slate-50"
                >
                  <Edit3 size={14} />
                  Düzenle
                </button>

                <button
                  type="button"
                  onClick={() => openDeleteModal(group)}
                  disabled={group.name === DEFAULT_GROUP_NAME}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Sil
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
          <h2 className="text-[16px] font-black text-[#0f1f4d]">
            Grup yönetimi ipuçları
          </h2>
          <ul className="mt-4 space-y-3 text-[12px] leading-6 text-slate-600">
            <li>Gruplar müşteri segmentasyonu için merkezi sözlük görevi görür.</li>
            <li>Grup adını değiştirdiğinizde o gruptaki tüm müşteriler otomatik güncellenir.</li>
            <li>Silinen gruptaki müşteriler &quot;Genel&quot; grubuna taşınır.</li>
            <li>Genel grubu silinemez; varsayılan grup olarak kalır.</li>
          </ul>
        </aside>
      </section>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-[#0f1f4d]">
              {modalMode === "create"
                ? "Yeni Grup Oluştur"
                : modalMode === "edit"
                  ? "Grubu Düzenle"
                  : "Grubu Sil"}
            </h3>

            {modalMode === "delete" ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {selectedGroup?.name} grubunu silmek istediğinize emin misiniz?
                Bu gruptaki müşteriler Genel grubuna taşınacak.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Grup Adı
                  </label>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                    placeholder="Örn. Bayi"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Renk
                  </label>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {CUSTOMER_GROUP_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, color }))
                        }
                        className={[
                          "rounded-xl border px-3 py-2 text-[11px] font-black capitalize transition",
                          getGroupColorClass(color),
                          form.color === color
                            ? "ring-2 ring-blue-300 ring-offset-2"
                            : "border-transparent",
                        ].join(" ")}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Not
                  </label>
                  <textarea
                    value={form.note}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, note: event.target.value }))
                    }
                    className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                    placeholder="Opsiyonel açıklama"
                  />
                </div>
              </div>
            )}

            {error ? (
              <p className="mt-4 text-[12px] font-bold text-rose-600">{error}</p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-[#24345f]"
              >
                Vazgeç
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (modalMode === "create") void handleCreate();
                  else if (modalMode === "edit") void handleUpdate();
                  else void handleDelete();
                }}
                className={[
                  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-black text-white",
                  modalMode === "delete"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-blue-600 hover:bg-blue-700",
                ].join(" ")}
              >
                {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                {modalMode === "create"
                  ? "Oluştur"
                  : modalMode === "edit"
                    ? "Kaydet"
                    : "Sil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-6 right-6">
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-blue-700 px-5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:opacity-95"
        >
          <Plus size={18} />
          Yeni Grup
        </button>
      </div>
    </>
  );
}
