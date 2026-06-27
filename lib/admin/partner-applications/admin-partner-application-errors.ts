export class AdminPartnerApplicationServiceError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "AdminPartnerApplicationServiceError";
    this.status = status;
    this.code = code;
  }
}
