"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import type {
  TenantMutationResponse,
  TenantMutationResult,
} from "@/lib/tenant-cache/tenant-mutation-types";

export type UseTenantMutationOptions<TData> = {
  /** RSC yenileme — varsayılan true */
  refresh?: boolean;
  onSuccess?: (data: TData, message?: string) => void | Promise<void>;
  onError?: (error: string) => void;
};

/**
 * Kontrollü tenant mutation:
 * - duplicate submit engeli
 * - request boyunca disabled state
 * - başarıda tek syncTenantViews (router.refresh + hook refetch)
 */
export function useTenantMutation<TData = unknown>(
  options: UseTenantMutationOptions<TData> = {},
) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const syncViews = useCallback(() => {
    notifyTenantCacheSync();
    if (options.refresh !== false) {
      startTransition(() => router.refresh());
    }
  }, [router, options.refresh]);

  const mutate = useCallback(
    async (
      url: string,
      init: RequestInit,
    ): Promise<TenantMutationResult<TData>> => {
      if (inFlightRef.current) {
        return { ok: false, error: "duplicate_submit" };
      }

      inFlightRef.current = true;
      setIsSubmitting(true);

      try {
        const response = await fetch(url, init);
        const json = (await response.json()) as TenantMutationResponse<TData>;

        if (!response.ok || !json.success) {
          const error = json.message ?? "İşlem başarısız.";
          options.onError?.(error);
          return {
            ok: false,
            error,
            status: response.status,
            errors: json.errors,
          };
        }

        const data = json.data as TData;
        await options.onSuccess?.(data, json.message);
        syncViews();

        return { ok: true, data, message: json.message };
      } catch {
        const error = "Sunucuya bağlanırken bir hata oluştu.";
        options.onError?.(error);
        return { ok: false, error };
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [options, syncViews],
  );

  return { mutate, isSubmitting, syncViews };
}

/** Optimistic toggle — yalnızca güvenli metadata (favori, aktif/pasif). */
export function useOptimisticTenantToggle<T extends { id: string }>(
  items: T[],
  setItems: (next: T[]) => void,
  patch: (item: T) => T,
) {
  const { mutate, isSubmitting } = useTenantMutation<{ id: string }>({
    refresh: false,
  });

  const toggle = useCallback(
    async (item: T, url: string, init: RequestInit) => {
      const previous = items;
      setItems(items.map((row) => (row.id === item.id ? patch(row) : row)));

      const result = await mutate(url, init);
      if (!result.ok) {
        setItems(previous);
      } else {
        notifyTenantCacheSync();
      }
      return result;
    },
    [items, mutate, patch, setItems],
  );

  return { toggle, isSubmitting };
}
