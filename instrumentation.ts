export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runBillingStartupValidation } = await import("./lib/payments/billing-startup-validation");
    runBillingStartupValidation();
  }
}
