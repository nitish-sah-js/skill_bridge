import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "./errors";
import { ConfigurationError } from "@/lib/env";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: AppError) {
  return NextResponse.json<ApiFailure>(
    { ok: false, error: { code: error.code, message: error.message, details: error.details } },
    { status: error.status, headers: { "Cache-Control": "no-store" } },
  );
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof z.ZodError) {
    return new AppError("VALIDATION_FAILED", "Some of the submitted data is invalid.", z.flattenError(error).fieldErrors);
  }
  if (error instanceof ConfigurationError) {
    console.error("[config]", error.message);
    return new AppError("SERVICE_UNAVAILABLE", "This feature is not configured on the server yet.");
  }
  console.error("[api] unexpected error:", error instanceof Error ? error.message : error);
  return new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.");
}

/** Run a route handler body and convert any thrown error into a consistent JSON failure. */
export async function handle<T>(fn: () => Promise<T>, successStatus = 200) {
  try {
    return ok(await fn(), successStatus);
  } catch (error) {
    return fail(toAppError(error));
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_FAILED", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export const uuidParam = z.string().uuid();
