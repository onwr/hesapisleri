import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOnboardingChecklist,
  calculateChecklistProgressPercent,
} from "@/lib/onboarding/onboarding-progress";
import {
  sanitizeOnboardingReturnTo,
  isOnboardingExemptPath,
} from "@/lib/onboarding/onboarding-routes";
import { onboardingProgressPatchSchema } from "@/lib/onboarding/onboarding-schemas";
import {
  shouldForceOnboardingRedirect,
  resolveOnboardingRedirectPath,
} from "@/lib/onboarding/onboarding-redirect";
import { isCompanyProfileComplete } from "@/lib/onboarding/onboarding-company-utils";
import { rejectMismatchedBodyCompanyId } from "@/lib/tenant/tenant-guards";
import { TenantForbiddenError } from "@/lib/tenant/tenant-errors";

describe("Faz 20 onboarding schemas", () => {
  it("progress patch strict schema companyId kabul etmez", () => {
    const parsed = onboardingProgressPatchSchema.safeParse({
      currentStep: 2,
      companyId: "foreign",
    });
    assert.equal(parsed.success, false);
  });

  it("client milestone alanı reddedilir", () => {
    const parsed = onboardingProgressPatchSchema.safeParse({
      currentStep: 2,
      productCount: 99,
    });
    assert.equal(parsed.success, false);
  });
});

describe("Faz 20 returnTo allowlist", () => {
  it("internal route kabul edilir", () => {
    assert.equal(
      sanitizeOnboardingReturnTo("/products/new?returnTo=/onboarding"),
      "/products/new?returnTo=/onboarding"
    );
  });

  it("open redirect reddedilir", () => {
    assert.equal(
      sanitizeOnboardingReturnTo("https://evil.com"),
      "/onboarding"
    );
    assert.equal(sanitizeOnboardingReturnTo("//evil.com"), "/onboarding");
  });
});

describe("Faz 20 redirect policy", () => {
  it("NOT_STARTED onboarding zorlar", () => {
    assert.equal(
      shouldForceOnboardingRedirect({ status: "NOT_STARTED" }, false),
      true
    );
  });

  it("COMPLETED onboarding zorlamaz", () => {
    assert.equal(
      shouldForceOnboardingRedirect({ status: "COMPLETED" }, false),
      false
    );
  });

  it("super admin zorlanmaz", () => {
    assert.equal(
      shouldForceOnboardingRedirect({ status: "NOT_STARTED" }, true),
      false
    );
  });

  it("IN_PROGRESS kaldığı adıma yönlendirir", () => {
    assert.equal(
      resolveOnboardingRedirectPath(
        { status: "IN_PROGRESS", currentStep: 3 },
        false
      ),
      "/onboarding?step=3"
    );
  });

  it("onboarding exempt route'lar", () => {
    assert.equal(isOnboardingExemptPath("/onboarding"), true);
    assert.equal(isOnboardingExemptPath("/companies/select"), true);
    assert.equal(isOnboardingExemptPath("/dashboard"), false);
  });
});

describe("Faz 20 milestone checklist", () => {
  it("ilerleme yüzdesi gerçek tamamlanan maddelerden hesaplanır", () => {
    const items = buildOnboardingChecklist({
      companyProfileComplete: true,
      hasDefaultWarehouse: true,
      hasDefaultCashAccount: true,
      productCount: 1,
      stockMovementCount: 0,
      customerCount: 0,
      saleCount: 0,
      integrationCount: 0,
      teamMemberCount: 1,
    });

    assert.equal(items.length, 7);
    assert.equal(calculateChecklistProgressPercent(items), 29);
    assert.equal(items.find((i) => i.id === "first_product")?.completed, true);
    assert.equal(items.find((i) => i.id === "first_sale")?.completed, false);
  });

  it("firma profili tamamlanma heuristic", () => {
    assert.equal(isCompanyProfileComplete("İşletmem"), false);
    assert.equal(isCompanyProfileComplete("Acme Ticaret"), true);
  });
});

describe("Faz 20 tenant body companyId", () => {
  it("body companyId reddedilir", () => {
    assert.throws(
      () => rejectMismatchedBodyCompanyId("company-b", "company-a"),
      TenantForbiddenError
    );
  });
});

describe("Faz 20 create company onboarding seed", () => {
  it("create-company-service onboarding kaydı oluşturur", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "lib/create-company-service.ts"),
      "utf8"
    );
    assert.ok(src.includes("createOnboardingForNewCompany"));
  });
});

describe("Faz 20 dashboard checklist component", () => {
  it("dashboard start checklist mevcut", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "components/dashboard/dashboard-start-checklist.tsx"),
      "utf8"
    );
    assert.ok(src.includes("Başlangıç Rehberi"));
    assert.ok(src.includes("/api/onboarding/checklist"));
  });
});
