export class TenantNotFoundError extends Error {
  readonly status = 404;

  constructor(message = "Kayıt bulunamadı.") {
    super(message);
    this.name = "TenantNotFoundError";
  }
}

export class TenantForbiddenError extends Error {
  readonly status = 403;

  constructor(message = "Bu firma için erişim yetkiniz bulunmuyor.") {
    super(message);
    this.name = "TenantForbiddenError";
  }
}

export class TenantUnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Oturum gerekli.") {
    super(message);
    this.name = "TenantUnauthorizedError";
  }
}
