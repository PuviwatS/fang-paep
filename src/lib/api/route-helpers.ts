import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ApiError, badRequest } from "./errors";

/** Wrap a route handler so any ApiError (or unexpected error) becomes a JSON error response. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<unknown>) {
  return async (...args: Args) => {
    try {
      const data = await fn(...args);
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError("server_error", "เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง", 500);
      if (apiError.status >= 500) console.error(error);
      return NextResponse.json(apiError.toBody(), { status: apiError.status });
    }
  };
}

export function parseQuery<T>(schema: ZodType<T>, request: Request): T {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) throw badRequest();
  return result.data;
}

export async function parseBody<T>(schema: ZodType<T>, request: Request): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest();
  }
  const result = schema.safeParse(body);
  if (!result.success) throw badRequest();
  return result.data;
}
