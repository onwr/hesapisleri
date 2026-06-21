export class PromotionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PromotionError";
    this.status = status;
  }
}
