import { z } from "zod";

export const sipayTokenResponseSchema = z.object({
  status_code: z.number(),
  status_description: z.string(),
  data: z
    .object({
      token: z.string(),
      expires_at: z.string(),
      is_3d: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(4)]),
    })
    .optional(),
});

export const sipayPurchaseLinkInvoiceSchema = z.object({
  invoice_id: z.string().min(1),
  invoice_description: z.string(),
  total: z.string(),
  discount: z.number(),
  coupon: z.null(),
  return_url: z.string().url(),
  cancel_url: z.string().url(),
  items: z.array(
    z.object({
      name: z.string(),
      price: z.string(),
      quantity: z.number(),
      type: z.number(),
    }),
  ),
  response_method: z.literal("POST"),
  bill_email: z.string().optional(),
  bill_phone: z.string().optional(),
  sale_web_hook_key: z.string().optional(),
});

export const sipayPurchaseLinkRequestSchema = z
  .object({
    merchant_key: z.string().min(1),
    name: z.string(),
    surname: z.string(),
    currency_code: z.literal("TRY"),
    invoice: z.string().min(2),
  })
  .strict();

export const sipayPurchaseLinkSuccessSchema = z
  .object({
    status: z.literal(true),
    status_code: z.coerce.number(),
    success_message: z.string().optional(),
    link: z.string().url(),
    order_id: z.string().min(1),
  })
  .passthrough();

export const sipayPurchaseLinkErrorSchema = z
  .object({
    status: z.union([z.literal(false), z.literal("false")]).optional(),
    status_code: z.coerce.number(),
    status_description: z.string().optional(),
    success_message: z.string().optional(),
  })
  .passthrough();

/** @deprecated Eski nested format — yalnızca geriye dönük test mock'ları için */
export const sipayPurchaseLinkResponseSchema = z.object({
  status_code: z.number(),
  status_description: z.string(),
  data: z
    .object({
      invoice_id: z.string().optional(),
      link: z.string().optional(),
    })
    .optional(),
});

// Checkstatus: status_code 100 + transaction_status/payment_status kombinasyonu
export const sipayCheckStatusResponseSchema = z.object({
  status_code: z.number(),
  status_description: z.string(),
  data: z
    .object({
      invoice_id: z.string(),
      order_id: z.string().optional(),
      transaction_status: z.string().optional(), // "Approved", "Declined", "Pending" vb.
      payment_status: z.number(),               // 1=paid, 0=not_paid, 2=refunded
      transaction_amount: z.number().optional(),
      product_price: z.number().optional(),
      currency: z.string().optional(),
      transaction_type: z.string().optional(),
      total_refunded_amount: z.number().optional(),
      order_no: z.string().optional(),
      auth_code: z.string().optional(),
      transaction_id: z.string().optional(),
      error_code: z.string().optional(),
      error_description: z.string().optional(),
    })
    .optional(),
});

export const sipayRefundResponseSchema = z.object({
  status_code: z.number(),
  status_description: z.string(),
  data: z
    .object({
      refund_status: z.number().optional(),
      refund_amount: z.number().optional(),
      reference_no: z.string().optional(),
    })
    .optional()
    .nullable(),
});

export const sipayWebhookPayloadSchema = z
  .object({
    invoice_id: z.string().min(1),
    order_id: z.string().optional(),
    order_no: z.string().optional(),
    status: z.string().min(1),
    payment_status: z.union([z.string(), z.number()]).optional(),
    hash_key: z.string().min(1),
    amount: z.union([z.string(), z.number()]).optional(),
    currency: z.string().optional(),
    transaction_id: z.string().optional(),
    error_code: z.string().optional(),
    error_description: z.string().optional(),
    sipay_payment_method: z.string().optional(),
  })
  .passthrough();

export const sipayReturnParamsSchema = z.object({
  invoice_id: z.string().min(1),
  status: z.string().optional(),
  hash_key: z.string().optional(),
  order_id: z.string().optional(),
  sipay_payment_method: z.string().optional(),
  transaction_id: z.string().optional(),
});
