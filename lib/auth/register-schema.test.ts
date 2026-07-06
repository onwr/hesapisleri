import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerSchema } from "./register-schema";

const validPayload = {
  name: "Ahmet Yılmaz",
  email: "ahmet@example.com",
  password: "sifre1234",
  wantsCompanyInfo: true,
  companyName: "Örnek Ticaret",
  kvkkInformed: true as const,
  marketingConsent: false,
};

describe("registerSchema — gerçek unit testler (DB gerektirmez)", () => {
  it("geçerli payload kabul ediliyor", () => {
    const result = registerSchema.safeParse(validPayload);
    assert.equal(result.success, true);
  });

  it("boş ad reddediliyor", () => {
    const result = registerSchema.safeParse({ ...validPayload, name: "" });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.flatten().fieldErrors.name?.length);
    }
  });

  it("yalnız boşluktan oluşan ad (trim sonrası boş) reddediliyor", () => {
    const result = registerSchema.safeParse({ ...validPayload, name: "   " });
    assert.equal(result.success, false);
  });

  it("geçersiz e-posta reddediliyor", () => {
    const result = registerSchema.safeParse({ ...validPayload, email: "not-an-email" });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.flatten().fieldErrors.email?.length);
    }
  });

  it("e-posta lowercase + trim ediliyor", () => {
    const result = registerSchema.safeParse({ ...validPayload, email: "  Ahmet@EXAMPLE.com  " });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.email, "ahmet@example.com");
    }
  });

  it("kısa şifre (7 karakter) reddediliyor", () => {
    const result = registerSchema.safeParse({ ...validPayload, password: "abcdefg" });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.flatten().fieldErrors.password?.length);
    }
  });

  it("8 karakter şifre kabul ediliyor (minimum sınır)", () => {
    const result = registerSchema.safeParse({ ...validPayload, password: "abcdefgh" });
    assert.equal(result.success, true);
  });

  it("aşırı uzun şifre (129 karakter) reddediliyor", () => {
    const result = registerSchema.safeParse({ ...validPayload, password: "a".repeat(129) });
    assert.equal(result.success, false);
  });

  it("KVKK false reddediliyor", () => {
    const result = registerSchema.safeParse({ ...validPayload, kvkkInformed: false });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.flatten().fieldErrors.kvkkInformed?.length);
    }
  });

  it("KVKK alanı hiç gönderilmezse reddediliyor", () => {
    const { kvkkInformed: _omit, ...rest } = validPayload;
    const result = registerSchema.safeParse(rest);
    assert.equal(result.success, false);
  });

  it("firma adı zorunlu (wantsCompanyInfo true iken)", () => {
    const result = registerSchema.safeParse({ ...validPayload, companyName: "" });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.flatten().fieldErrors.companyName?.length);
    }
  });

  it("ad soyad alanında HTML tag reddediliyor", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      name: "<script>alert(1)</script>",
    });
    assert.equal(result.success, false);
  });

  it("firma adında HTML tag reddediliyor", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      companyName: "<img src=x onerror=alert(1)>",
    });
    assert.equal(result.success, false);
  });

  it("ad soyad alanında kontrol karakteri reddediliyor", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      name: `Ahmet${String.fromCharCode(0)}Yilmaz`,
    });
    assert.equal(result.success, false);
  });

  it("SQL injection metni normal metin gibi işlenir (Prisma parameterized query kullanıldığı için tehlikeli değil), yalnız uzunluk/format kurallarına tabi", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      name: "'; DROP TABLE users; --",
    });
    // Bu string HTML tag/kontrol karakteri içermiyor, uzunluk sınırında —
    // schema seviyesinde reddedilmesi ZORUNLU değil. Asıl güvenlik Prisma'nın
    // parameterized query kullanmasından gelir (raw SQL'e hiç birleştirilmiyor).
    assert.equal(result.success, true);
  });
});
