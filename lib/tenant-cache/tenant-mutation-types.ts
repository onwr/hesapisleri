/** Standart tenant mutation API response — client tahmin etmez, server authoritative. */
export type TenantMutationResponse<TEntity = unknown> = {
  success: boolean;
  message?: string;
  data?: TEntity & {
    affectedIds?: string[];
    status?: string;
    newBalance?: number | null;
    newStock?: number | null;
  };
  errors?: Record<string, string[] | undefined>;
};

export type TenantMutationResult<TData> =
  | { ok: true; data: TData; message?: string }
  | { ok: false; error: string; status?: number; errors?: Record<string, string[] | undefined> }
  | { ok: false; error: "duplicate_submit" };
