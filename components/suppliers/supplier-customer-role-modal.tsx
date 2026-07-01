"use client";

import { useEffect, useState, useTransition } from "react";

type Match = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxNo: string | null;
  matchReason: string;
  confidence: string;
};

export function SupplierCustomerRoleModal({
  supplierId,
  onClose,
  onSuccess,
}: {
  supplierId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/suppliers/${supplierId}/customer-role`);
        const json = await res.json();
        if (!json.success) {
          setError(json.message ?? "Eşleşmeler yüklenemedi.");
          return;
        }
        setMatches(json.data.matches ?? []);
      } catch {
        setError("Eşleşmeler yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supplierId]);

  function runAction(body: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/suppliers/${supplierId}/customer-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? "İşlem başarısız.");
        return;
      }
      onSuccess(json.message ?? "Müşteri rolü eklendi.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-[15px] font-bold text-[#0f1f4d]">Müşteri Rolü Ekle</h3>
        <p className="mt-1 text-[12px] text-slate-500">
          Otomatik birleştirme yapılmaz. Mevcut müşteriyle bağlayın veya yeni rol oluşturun.
        </p>

        {loading ? <p className="mt-4 text-[12px] text-slate-500">Eşleşmeler aranıyor…</p> : null}
        {error ? <p className="mt-4 text-[12px] text-red-600">{error}</p> : null}

        {!loading && matches.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-[12px] font-bold text-slate-700">Olası eşleşmeler</p>
            {matches.map((match) => (
              <button
                key={match.customerId}
                type="button"
                disabled={isPending}
                onClick={() => runAction({ action: "link", customerId: match.customerId })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-[12px] hover:bg-slate-50"
              >
                <span className="font-bold text-[#0f1f4d]">{match.name}</span>
                <span className="mt-1 block text-slate-500">{match.matchReason}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-bold"
            onClick={onClose}
          >
            İptal
          </button>
          <button
            type="button"
            disabled={isPending}
            className="rounded-xl bg-violet-600 px-4 py-2 text-[12px] font-bold text-white"
            onClick={() => runAction({ action: "create" })}
          >
            Yeni müşteri rolü oluştur
          </button>
        </div>
      </div>
    </div>
  );
}
