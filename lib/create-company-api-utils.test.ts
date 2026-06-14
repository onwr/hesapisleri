import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCreateCompanyResponse,
  filterCompaniesBySearch,
  parseCreateCompanyBody,
  validateCreateCompanyWizardStep,
} from "./create-company-api-utils";

const sampleCompanies = [
  {
    companyId: "1",
    companyName: "Alpha Ticaret",
    role: "OWNER",
    roleLabel: "Sahip",
    isOwner: true,
    isActive: true,
    isCurrent: true,
  },
  {
    companyId: "2",
    companyName: "Beta Lojistik",
    role: "STAFF",
    roleLabel: "Personel",
    isOwner: false,
    isActive: true,
    isCurrent: false,
  },
];

describe("create company API utils", () => {
  it("name boşsa parseCreateCompanyBody başarısız olur", () => {
    const parsed = parseCreateCompanyBody({ name: "   " });
    assert.equal(parsed.success, false);
  });

  it("geçerli body parse edilir", () => {
    const parsed = parseCreateCompanyBody({
      name: "Yeni Firma",
      taxNumber: "123",
      currency: "TRY",
      defaultVatRate: 20,
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.name, "Yeni Firma");
      assert.equal(parsed.data.taxNumber, "123");
    }
  });

  it("buildCreateCompanyResponse companyId ve companyName döner", () => {
    assert.deepEqual(
      buildCreateCompanyResponse({ id: "c1", name: "Demo A.Ş." }),
      {
        success: true,
        companyId: "c1",
        companyName: "Demo A.Ş.",
      }
    );
  });

  it("filterCompaniesBySearch firma adına göre filtreler", () => {
    const filtered = filterCompaniesBySearch(sampleCompanies, "beta");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.companyName, "Beta Lojistik");
  });

  it("wizard adım 1 name olmadan ilerletmez", () => {
    assert.equal(
      validateCreateCompanyWizardStep(1, { name: "A", email: "" }),
      "Firma adı en az 2 karakter olmalıdır."
    );
    assert.equal(
      validateCreateCompanyWizardStep(1, { name: "Alpha", email: "" }),
      null
    );
  });
});
