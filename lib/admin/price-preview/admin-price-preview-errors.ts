export class PricePreviewServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PricePreviewServiceError";
    this.status = status;
  }
}
