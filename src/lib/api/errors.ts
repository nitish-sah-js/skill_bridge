export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

/** An error whose message is safe to show to the student. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

/** Wrap a database error without leaking its internals to the client. */
export function dbError(context: string, error: { message?: string; code?: string } | null | undefined): AppError {
  console.error(`[db] ${context}:`, error?.code ?? "", error?.message ?? "");
  return new AppError("INTERNAL_ERROR", "Something went wrong while saving or loading your data. Please try again.");
}
