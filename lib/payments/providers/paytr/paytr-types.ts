export type PaytrRawCallbackPayload = Record<string, string>;

export type PaytrFormFields = Record<string, string>;

export type PaytrApiResponse = {
  status?: string;
  reason?: string;
  err_msg?: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  [key: string]: unknown;
};

export type PaytrCardMetadata = {
  cardBrand?: string;
  cardFamily?: string;
  bankName?: string;
  maskedPan?: string;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
};
