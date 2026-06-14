import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDirectoryCsvContent,
  buildDirectoryCsvRow,
  buildDirectoryCsvWithBom,
  formatDirectorySyncMessage,
  formatEmailHref,
  formatPhoneHref,
  getDirectoryDisplayName,
  getDirectoryPrimaryLine,
  getDirectorySourceLabel,
  getDirectorySourceManageMessage,
  getDirectoryTypeLabel,
  matchesDirectorySearch,
  toggleFavoriteValue,
  validateDirectoryContactInput,
} from "./directory-utils";

const sampleContact = {
  name: "Ali Veli",
  companyName: "ABC Ltd.",
  phone: "02121234567",
  mobilePhone: "05321234567",
  email: "ali@test.com",
  department: "Satış",
  title: "Müdür",
  tags: ["vip", "ankara"],
  notes: "Önemli müşteri",
};

describe("directory utils", () => {
  it("display name birleştirir", () => {
    assert.equal(
      getDirectoryDisplayName({ name: "Ali Veli", companyName: "ABC Ltd." }),
      "Ali Veli · ABC Ltd."
    );
    assert.equal(getDirectoryPrimaryLine({ name: "Ali Veli" }), "Ali Veli");
    assert.equal(
      getDirectoryPrimaryLine({ name: "", companyName: "ABC Ltd." }),
      "ABC Ltd."
    );
  });

  it("type ve source label döner", () => {
    assert.equal(getDirectoryTypeLabel("CUSTOMER"), "Müşteri");
    assert.equal(getDirectoryTypeLabel("EMPLOYEE"), "Çalışan");
    assert.equal(getDirectorySourceLabel("MANUAL"), "Manuel");
    assert.equal(getDirectorySourceLabel("CUSTOMER"), "Müşteri");
    assert.equal(getDirectorySourceLabel("EMPLOYEE"), "Çalışan");
  });

  it("favorite toggle tersine çevirir", () => {
    assert.equal(toggleFavoriteValue(false), true);
    assert.equal(toggleFavoriteValue(true), false);
  });

  it("ad veya firma zorunludur", () => {
    const invalid = validateDirectoryContactInput({ name: "", companyName: "" });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.match(invalid.message, /zorunlu/i);
    }

    assert.equal(validateDirectoryContactInput({ name: "Ali" }).ok, true);
    assert.equal(
      validateDirectoryContactInput({ companyName: "Firma A.Ş." }).ok,
      true
    );
  });

  it("csv satırı ve BOM üretir", () => {
    const row = buildDirectoryCsvRow({
      id: "1",
      type: "PERSON",
      sourceType: "MANUAL",
      sourceId: null,
      name: "Ali Veli",
      companyName: "ABC",
      title: "Müdür",
      department: "Satış",
      phone: "0212",
      mobilePhone: "0532",
      email: "ali@test.com",
      website: null,
      address: "Adres",
      city: "İstanbul",
      district: "Kadıköy",
      taxNumber: null,
      notes: "Not",
      tags: ["vip", "b2b"],
      isFavorite: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    assert.equal(row[0], "Kişi");
    assert.equal(row[1], "Ali Veli");
    assert.equal(row[11], "vip; b2b");
    assert.equal(row[12], "Not");

    const csv = buildDirectoryCsvContent([
      {
        id: "1",
        type: "CUSTOMER",
        sourceType: "CUSTOMER",
        sourceId: "c1",
        name: "Müşteri A",
        companyName: null,
        title: null,
        department: null,
        phone: null,
        mobilePhone: null,
        email: null,
        website: null,
        address: null,
        city: null,
        district: null,
        taxNumber: null,
        notes: null,
        tags: [],
        isFavorite: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    assert.match(csv, /Müşteri A/);

    const withBom = buildDirectoryCsvWithBom([]);
    assert.ok(withBom.startsWith("\uFEFF"));
  });

  it("arama ad, firma, telefon, etiket ve departmanda çalışır", () => {
    assert.equal(matchesDirectorySearch(sampleContact, "ali"), true);
    assert.equal(matchesDirectorySearch(sampleContact, "abc"), true);
    assert.equal(matchesDirectorySearch(sampleContact, "0532"), true);
    assert.equal(matchesDirectorySearch(sampleContact, "ali@test.com"), true);
    assert.equal(matchesDirectorySearch(sampleContact, "satış"), true);
    assert.equal(matchesDirectorySearch(sampleContact, "vip"), true);
    assert.equal(matchesDirectorySearch(sampleContact, "bulunamaz"), false);
    assert.equal(matchesDirectorySearch(sampleContact, ""), true);
  });

  it("tel ve mailto linkleri boş değerde null döner", () => {
    assert.equal(formatPhoneHref(""), null);
    assert.equal(formatPhoneHref("0532 111 22 33"), "tel:05321112233");
    assert.equal(formatEmailHref(""), null);
    assert.equal(formatEmailHref("a@b.com"), "mailto:a@b.com");
  });

  it("kaynak yönetim mesajı döner", () => {
    assert.match(
      getDirectorySourceManageMessage("CUSTOMER") ?? "",
      /müşteri kartından/i
    );
    assert.match(
      getDirectorySourceManageMessage("EMPLOYEE") ?? "",
      /çalışan kartından/i
    );
    assert.equal(getDirectorySourceManageMessage("MANUAL"), null);
  });

  it("sync mesajı özetler", () => {
    assert.equal(
      formatDirectorySyncMessage({ created: 2, updated: 3, skipped: 1 }),
      "2 yeni, 3 güncellendi, 1 değişmedi."
    );
  });
});
