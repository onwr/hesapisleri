export class AdminJobServiceError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "AdminJobServiceError";
    this.status = status;
    this.code = code;
  }
}
