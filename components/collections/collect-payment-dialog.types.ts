export type CollectPaymentTarget = {
  type: "SALE" | "INVOICE";
  id: string;
  documentNo: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  viaInvoice?: boolean;
  linkedInvoiceId?: string | null;
};
