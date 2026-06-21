export class AddOnServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AddOnServiceError";
    this.status = status;
  }
}
