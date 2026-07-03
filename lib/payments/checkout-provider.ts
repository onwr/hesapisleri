import type { PaymentProvider } from "@prisma/client";

export type CheckoutItem = {
  name: string;
  priceMinor: number;
  quantity: number;
  description?: string;
  productName?: string;
};

export type CreateCheckoutInput = {
  invoiceId: string;
  idempotencyKey: string;
  companyId: string;
  userId?: string;
  amountMinor: number;
  currency: string;
  payerEmail: string;
  payerName: string;
  payerPhone?: string;
  payerIp: string;
  items: CheckoutItem[];
  returnUrl: string;
  cancelUrl: string;
  testMode: boolean;
};

export type CreateCheckoutResult = {
  invoiceId: string;
  checkoutUrl: string;
  expiresAt?: Date;
};

export type CheckStatusResult = {
  invoiceId: string;
  status: "PAID" | "NOT_PAID" | "REFUNDED" | "UNKNOWN";
  amountMinor?: number;
  currency?: string;
  providerPaymentId?: string;
  providerErrorCode?: string;
  providerErrorMessage?: string;
};

export type VerifyReturnResult = {
  invoiceId: string;
  valid: boolean;
  status?: string;
};

export type VerifyWebhookResult = {
  invoiceId: string;
  status: "PAID" | "FAILED" | "REFUNDED";
  providerPaymentId?: string;
};

export type RefundInput = {
  invoiceId: string;
  referenceNo: string;
  amountMinor: number;
};

export type RefundResult = {
  referenceNo: string;
  status: "SUCCEEDED" | "FAILED" | "UNKNOWN";
  providerStatus?: string;
};

export type CheckoutProvider = {
  provider: PaymentProvider;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  checkStatus(invoiceId: string): Promise<CheckStatusResult>;
  verifyReturn(params: Record<string, string>): VerifyReturnResult;
  verifyWebhook(payload: Record<string, string>): VerifyWebhookResult;
  refund(input: RefundInput): Promise<RefundResult>;
};
