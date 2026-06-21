export type EfaturamStoredCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  email?: string;
  password?: string;
};

export type EfaturamSignInResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type EfaturamCustomerSignInResponse = {
  accessToken: string;
  refreshToken?: string;
  userId: number | string;
  companyId: number | string;
  partnerCustomerId?: number | string;
  expiresIn?: number;
};

export type EfaturamTaxpayerAlias = {
  alias: string;
  type?: string;
  title?: string;
  active?: boolean;
};

export type EfaturamTaxpayerLookupResult = {
  taxId: string;
  title?: string;
  aliases: EfaturamTaxpayerAlias[];
  recommendedDocumentType: "E_INVOICE" | "E_ARCHIVE";
  activeInvoiceAliases: EfaturamTaxpayerAlias[];
};

export type EfaturamDocumentCreateResponse = {
  invoiceUuid?: string;
  invoiceId?: string;
  status?: number;
  gibStatusCode?: number;
  gibStatus?: string;
  localReferenceId?: string;
  [key: string]: unknown;
};

export type EfaturamDocumentStatusResponse = {
  status?: number;
  gibStatusCode?: number;
  gibStatus?: string;
  invoiceUuid?: string;
  invoiceId?: string;
  [key: string]: unknown;
};

export type EfaturamApplicationStatusResponse = {
  partnerCustomerId?: number | string;
  applicationDetail?: Array<{
    type?: number;
    gibStatus?: string;
    activated?: boolean;
    serviceName?: string;
  }>;
};
