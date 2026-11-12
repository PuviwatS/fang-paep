import { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  void _next;
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request" } });
    return;
  }
  if (typeof error === "object" && error && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 400 || status === 413) {
      res.status(status).json({
        error: {
          code: status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
          message: status === 413 ? "Request body is too large" : "Invalid JSON",
        },
      });
      return;
    }
  }
  if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "23505") {
    res.status(409).json({ error: { code: "CONFLICT", message: "Resource already exists" } });
    return;
  }
  console.error("Unhandled API error", error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
};

export const asyncHandler =
  (
    fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => Promise<void>,
  ): RequestHandler =>
  (req, res, next) => {
    void fn(req, res).catch(next);
  };
