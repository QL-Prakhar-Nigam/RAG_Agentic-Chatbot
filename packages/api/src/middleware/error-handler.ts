import type { NextFunction, Request, Response } from "express";

// Structured error responses everywhere — never a raw stack trace or an
// unhandled rejection reaching the client (local/planning/01-architecture.md).
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({
    error: {
      message: "Internal server error",
    },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      message: "Not found",
    },
  });
}
