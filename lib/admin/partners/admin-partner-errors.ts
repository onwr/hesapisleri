export class AdminPartnerServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminPartnerServiceError";
    this.status = status;
  }
}
