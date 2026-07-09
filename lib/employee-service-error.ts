export class EmployeeServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EmployeeServiceError";
    this.status = status;
  }
}
