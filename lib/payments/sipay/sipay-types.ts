// is_3d capability values returned by Sipay token endpoint
export const IS3D_CAPABILITY = {
  UNSUPPORTED: 0,
  THREE_D_OR_2D: 1,
  THREE_D_ONLY: 2,
  BRANDED: 4,
} as const;
export type SipayIs3dCapability = (typeof IS3D_CAPABILITY)[keyof typeof IS3D_CAPABILITY];

// ─── Token ─────────────────────────────────────────────────────────────────────
export type SipayTokenRequest = {
  app_id: string;
  app_secret: string;
};

export type SipayTokenResponse = {
  status_code: number;
  status_description: string;
  data?: {
    token: string;
    expires_at: string; // ISO datetime
    is_3d: SipayIs3dCapability;
  };
};

// ─── Purchase/link (POST /ccpayment/purchase/link) ─────────────────────────────
export type SipayPurchaseLinkItem = {
  name: string;
  description: string;
  price: string; // "9.90" — 2 ondalık, string
  quantity: number;
  type: number; // 1 = product
};

/** Nested invoice object — API'ye JSON string olarak gönderilir. */
export type SipayPurchaseInvoice = {
  invoice_id: string;
  invoice_description: string;
  total: string;
  discount: number;
  coupon: string | null;
  return_url: string;
  cancel_url: string;
  items: SipayPurchaseLinkItem[];
  response_method: "POST";
  bill_email?: string;
  bill_phone?: string;
  sale_web_hook_key?: string;
};

/** Top-level purchase/link request body. */
export type SipayPurchaseLinkRequest = {
  merchant_key: string;
  merchant_id: string;
  name: string;
  surname: string;
  currency_code: "TRY";
  invoice: string;
};

export type SipayPurchaseLinkSuccessResponse = {
  status: true;
  status_code: number;
  success_message?: string;
  link: string;
  order_id: string;
};

export type SipayPurchaseLinkErrorResponse = {
  status?: false | "false";
  status_code: number;
  status_description?: string;
  success_message?: string;
};

export type SipayPurchaseLinkResponse =
  | SipayPurchaseLinkSuccessResponse
  | SipayPurchaseLinkErrorResponse;

// ─── Checkstatus (POST /ccpayment/api/checkstatus) ─────────────────────────────
export type SipayCheckStatusRequest = {
  invoice_id: string;
  merchant_key: string;
  hashKey: string;
};

export type SipayCheckStatusData = {
  invoice_id: string;
  order_id?: string;          // provider order reference
  transaction_status?: string; // string status (e.g. "Approved", "Declined")
  payment_status: number;     // 1=paid, 0=not_paid, 2=refunded
  transaction_amount?: number; // kullanılabiliyorsa
  product_price?: number;     // alternatif tutar alanı
  currency?: string;
  transaction_type?: string;  // "Sale", "Refund" vb.
  total_refunded_amount?: number;
  order_no?: string;
  auth_code?: string;
  transaction_id?: string;
  error_code?: string;
  error_description?: string;
};

export type SipayCheckStatusResponse = {
  status_code: number;
  status_description: string;
  data?: SipayCheckStatusData;
};

// ─── Refund (POST /ccpayment/api/refund) ──────────────────────────────────────
export type SipayRefundRequest = {
  invoice_id: string;
  amount: string; // "50.00" — 2 ondalık, string
  reference_no: string;
  hashKey: string;
};

export type SipayRefundResponse = {
  status_code: number;
  status_description: string;
  data?: {
    refund_status?: number;
    refund_amount?: number;
    reference_no?: string;
  };
};

// ─── Webhook payload ───────────────────────────────────────────────────────────
export type SipayWebhookPayload = {
  invoice_id: string;
  order_no?: string;
  status: string; // "1"=paid, "0"=failed, "2"=refunded
  sipay_payment_method?: string;
  transaction_id?: string;
  error_code?: string;
  error_description?: string;
  hash_key: string;
};

// ─── Return URL params (POST form-encoded) ─────────────────────────────────────
export type SipayReturnParams = {
  invoice_id: string;
  status: string;
  hash_key?: string;
  order_id?: string;
  sipay_payment_method?: string;
  transaction_id?: string;
  [key: string]: string | undefined;
};
