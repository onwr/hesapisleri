import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  API_USER_ERROR_MESSAGES,
  getFirstZodErrorMessage,
  humanizeZodFieldError,
  mapZodFieldErrors,
  sanitizeUserFacingApiError,
} from "./api-user-error";

describe("api-user-error", () => {
  it("canonical API mesajları Türkçe", () => {
    assert.match(API_USER_ERROR_MESSAGES.UNAUTHORIZED, /oturum/i);
    assert.match(API_USER_ERROR_MESSAGES.FORBIDDEN, /yetkiniz/i);
    assert.match(API_USER_ERROR_MESSAGES.NOT_FOUND, /bulunamadı/i);
    assert.match(API_USER_ERROR_MESSAGES.INTERNAL_ERROR, /Beklenmeyen/i);
  });

  it("Zod Required mesajını Türkçeleştirir", () => {
    assert.equal(humanizeZodFieldError("email", "Required"), "Bu alan zorunludur.");
  });

  it("Invalid email mesajını Türkçeleştirir", () => {
    assert.equal(
      humanizeZodFieldError("email", "Invalid email"),
      "Geçerli bir e-posta adresi girin."
    );
  });

  it("mapZodFieldErrors alan etiketlerini kullanır", () => {
    const mapped = mapZodFieldErrors(
      { password: ["String must contain at least 8 character(s)"] },
      { password: "Şifre" }
    );
    assert.equal(mapped.password, "Şifre çok kısa.");
  });

  it("getFirstZodErrorMessage ilk hatayı döner", () => {
    const message = getFirstZodErrorMessage(
      { name: ["Required"] },
      { name: "Ad soyad" }
    );
    assert.equal(message, "Bu alan zorunludur.");
  });

  it("sanitizeUserFacingApiError Prisma mesajını gizler", () => {
    const message = sanitizeUserFacingApiError(
      new Error("Invalid `prisma.user.findUnique()` invocation")
    );
    assert.equal(message, API_USER_ERROR_MESSAGES.INTERNAL_ERROR);
  });
});
