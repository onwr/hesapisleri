const { pathToFileURL } = await import("node:url");
const { join, dirname } = await import("node:path");
const { fileURLToPath } = await import("node:url");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const resolverUrl = pathToFileURL(
  join(scriptDir, "..", "lib", "payments", "billing-provider-resolver.ts"),
).href;

const {
  getActiveBillingProvider,
  isPaytrCheckoutActive,
  isSipayCheckoutActive,
  resolveBillingPaymentProviderRaw,
} = await import(resolverUrl);

try {
  if (process.env.NODE_ENV === "production" && !process.env.BILLING_PAYMENT_PROVIDER) {
    resolveBillingPaymentProviderRaw();
    console.log(JSON.stringify({ ok: false, error: "expected throw" }));
    process.exit(1);
  }

  const provider = resolveBillingPaymentProviderRaw();
  console.log(
    JSON.stringify({
      ok: true,
      provider,
      active: getActiveBillingProvider(),
      paytr: isPaytrCheckoutActive(),
      sipay: isSipayCheckoutActive(),
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify({ ok: false, error: message }));
}
