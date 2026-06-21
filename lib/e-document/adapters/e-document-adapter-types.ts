import type {
  EDocumentProvider,
  EfaturamConnectionMode,
  EfaturamEnvironment,
  EfaturamIntegration,
} from "@prisma/client";

export type TrendyolUpsertInput = {
  companyId: string;
  connectionMode: EfaturamConnectionMode;
  environment: EfaturamEnvironment;
  email?: string;
  password?: string;
  prefix?: string | null;
  xsltCode?: string | null;
};

export type EfinansUpsertInput = {
  companyId: string;
  username?: string;
  password?: string;
  companyCode: string;
  environment: EfaturamEnvironment;
};

export type EDocumentUpsertInput =
  | ({ provider: "TRENDYOL_EFATURAM" } & TrendyolUpsertInput)
  | ({ provider: "EFINANS" } & EfinansUpsertInput)
  | { provider: "OTHER"; companyId: string };

export type EDocumentTestResult = {
  ok: boolean;
  message: string;
  tokenExpiresAt?: string | null;
};

export interface EDocumentProviderAdapter {
  provider: EDocumentProvider;
  upsert(input: EDocumentUpsertInput): Promise<EfaturamIntegration>;
  test(companyId: string): Promise<EDocumentTestResult>;
  disconnect(companyId: string): Promise<EfaturamIntegration | null>;
}
