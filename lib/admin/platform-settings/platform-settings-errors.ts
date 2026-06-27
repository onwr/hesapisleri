export class AdminPlatformSettingsServiceError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "AdminPlatformSettingsServiceError";
    this.status = status;
    this.code = code;
  }
}

export class MaintenanceModeActiveError extends Error {
  readonly status = 503;
  readonly code = "MAINTENANCE_MODE_ACTIVE";

  constructor(message = "Platform bakım modunda.") {
    super(message);
    this.name = "MaintenanceModeActiveError";
  }
}

export class RegistrationDisabledError extends Error {
  readonly status = 403;
  readonly code = "REGISTRATION_DISABLED";

  constructor(message = "Yeni kayıtlar geçici olarak kapalı.") {
    super(message);
    this.name = "RegistrationDisabledError";
  }
}
