import type {
  MembershipPaymentStatus,
  MembershipPaymentType,
  PaymentProvider,
} from "@prisma/client";

export type BillingPeriod = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY";

export type PriceSnapshot = {
  planId: string;
  planNameSnapshot: string;
  billingPeriodSnapshot: BillingPeriod;
  periodMonthsSnapshot: number;
  basePriceMinor: number;
  discountMinor: number;
  subtotalMinor: number;
  vatRateSnapshot: number;
  vatMinor: number;
  totalMinor: number;
  currency: string;
  campaignId?: string;
  campaignCodeSnapshot?: string;
  planEntitlementsSnapshot?: unknown;
};

export type InitialPaymentPayload = {
  paymentId: string;
  merchantOid: string;
  mode: "iframe" | "direct";
  actionUrl?: string;
  fields?: Record<string, string>;
  iframeToken?: string;
  iframeUrl?: string;
};

export type VerifiedPaymentCallback = {
  merchantOid: string;
  status: "success" | "failed";
  totalAmountMinor: number;
  currency: string;
  providerStatus: string;
  failedReasonCode?: string;
  failedReasonMessage?: string;
  providerPaymentId?: string;
  testMode: boolean;
  externalUserToken?: string;
  externalCardToken?: string;
  cardMetadata?: ProviderPaymentMethodMetadata;
  rawPayload: Record<string, string>;
};

export type ProviderPaymentMethodMetadata = {
  displayName?: string;
  cardBrand?: string;
  cardFamily?: string;
  bankName?: string;
  maskedPan?: string;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
};

export type RecurringPaymentResult = {
  merchantOid: string;
  status: "success" | "wait_callback" | "failed" | "unknown";
  providerStatus?: string;
  providerErrorCode?: string;
  providerErrorMessage?: string;
};

export type ProviderPaymentStatus = {
  merchantOid: string;
  status: MembershipPaymentStatus;
  providerStatus: string;
  amountMinor?: number;
  currency?: string;
  raw?: unknown;
};

export type ProviderRefundResult = {
  referenceNo: string;
  status: "succeeded" | "failed" | "unknown";
  providerStatus?: string;
  raw?: unknown;
};

export type ProviderPaymentMethod = ProviderPaymentMethodMetadata & {
  provider: PaymentProvider;
  externalUserToken: string;
  externalCardToken: string;
};

export type CreateInitialPaymentInput = {
  merchantOid: string;
  amountMinor: number;
  currency: string;
  payerEmail: string;
  payerName: string;
  payerPhone?: string;
  payerIp: string;
  okUrl: string;
  failUrl: string;
  basket: Array<{ name: string; amountMinor: number; quantity: number }>;
  saveCard: boolean;
  externalUserToken?: string;
  testMode: boolean;
};

export type ChargeSavedCardInput = {
  merchantOid: string;
  amountMinor: number;
  currency: string;
  payerEmail: string;
  payerIp: string;
  externalUserToken: string;
  externalCardToken: string;
  testMode: boolean;
};

export type PaymentProviderAdapter = {
  provider: PaymentProvider;
  createInitialPayment(input: CreateInitialPaymentInput): Promise<InitialPaymentPayload>;
  verifyCallback(input: {
    payload: Record<string, string>;
  }): VerifiedPaymentCallback;
  chargeSavedCard(input: ChargeSavedCardInput): Promise<RecurringPaymentResult>;
  queryPayment(input: { merchantOid: string }): Promise<ProviderPaymentStatus>;
  refundPayment(input: {
    merchantOid: string;
    referenceNo: string;
    amountMinor: number;
  }): Promise<ProviderRefundResult>;
  listPaymentMethods(input: {
    externalUserToken: string;
  }): Promise<ProviderPaymentMethod[]>;
  deletePaymentMethod(input: {
    externalUserToken: string;
    externalCardToken: string;
  }): Promise<void>;
};

export type PaymentAttemptInput = {
  companyId: string;
  userId: string;
  type: MembershipPaymentType;
  planId: string;
  period: BillingPeriod;
  autoRenew: boolean;
  saveCard: boolean;
  consentVersion?: string;
  idempotencyKey: string;
  payerIp: string;
};
