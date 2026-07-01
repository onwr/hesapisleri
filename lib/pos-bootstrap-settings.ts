import { allowsNegativeStock } from "@/lib/stock-policy";
import { SALE_VAT_PRESETS } from "@/lib/sale-calculation-utils";
import {
  getPosPaymentMethodLabel,
  type PosPaymentMethod,
} from "@/lib/pos-checkout-utils";

const CANONICAL_PAYMENT_METHODS: PosPaymentMethod[] = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
];

/**
 * Canonical POS runtime settings.
 * These are not per-company DB columns; sources are documented explicitly.
 */
export function getPosBootstrapSettings() {
  const defaultTaxRate = SALE_VAT_PRESETS.includes(20) ? 20 : SALE_VAT_PRESETS[0]!;

  return {
    allowNegativeStock: {
      value: allowsNegativeStock(),
      source: "stock-policy.allowsNegativeStock",
    },
    pricesIncludeTax: {
      value: false as const,
      source:
        "sale-calculation-utils: KDV satır alt toplamına eklenir (fiyatlar KDV hariç)",
      supported: true as const,
    },
    defaultTaxRate: {
      value: defaultTaxRate,
      source: "prisma/schema.prisma Product.vatRate @default(20)",
      supported: true as const,
    },
    receiptEnabled: {
      value: true as const,
      source: "components/pos/pos-receipt.tsx — yazdırma akışı mevcut",
      supported: true as const,
    },
    paymentMethods: {
      value: CANONICAL_PAYMENT_METHODS.map((method) => ({
        id: method,
        label: getPosPaymentMethodLabel(method),
      })),
      source: "pos-checkout-utils PosPaymentMethod enum",
    },
    discountPolicy: {
      cartDiscountType: "AMOUNT" as const,
      lineDiscountSupported: false as const,
      percentDiscountSupported: false as const,
      source: "pos-checkout-utils.calculatePosTotals → calculateSaleTotals AMOUNT only",
    },
  };
}

export function serializePosBootstrapSettingsForMobile() {
  const settings = getPosBootstrapSettings();
  return {
    allowNegativeStock: settings.allowNegativeStock.value,
    pricesIncludeTax: settings.pricesIncludeTax.value,
    defaultTaxRate: settings.defaultTaxRate.value,
    receiptEnabled: settings.receiptEnabled.value,
    discountType: settings.discountPolicy.cartDiscountType,
    policySources: {
      allowNegativeStock: settings.allowNegativeStock.source,
      pricesIncludeTax: settings.pricesIncludeTax.source,
      defaultTaxRate: settings.defaultTaxRate.source,
      receiptEnabled: settings.receiptEnabled.source,
      paymentMethods: settings.paymentMethods.source,
      discount: settings.discountPolicy.source,
    },
  };
}
