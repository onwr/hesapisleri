export class SipayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "SipayError";
  }
}

export class SipayHashError extends SipayError {
  constructor(message: string) {
    super(message, "HASH_INVALID");
    this.name = "SipayHashError";
  }
}

export class SipayTokenError extends SipayError {
  constructor(message: string) {
    super(message, "TOKEN_ERROR");
    this.name = "SipayTokenError";
  }
}

export class SipayCapabilityError extends SipayError {
  constructor(message: string) {
    super(message, "CAPABILITY_UNSUPPORTED");
    this.name = "SipayCapabilityError";
  }
}

export class SipayNetworkError extends SipayError {
  constructor(message: string, statusCode?: number) {
    super(message, "NETWORK_ERROR", statusCode);
    this.name = "SipayNetworkError";
  }
}

export class SipayCheckstatusUnavailableError extends SipayError {
  constructor(message: string) {
    super(message, "CHECKSTATUS_UNAVAILABLE");
    this.name = "SipayCheckstatusUnavailableError";
  }
}
