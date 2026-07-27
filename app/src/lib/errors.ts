import { ZodError } from "zod";

export type AppErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status = statusFromCode(code)
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function statusFromCode(code: AppErrorCode) {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    default:
      return 500;
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid request payload.",
          issues: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  return Response.json({ error: { code: "INTERNAL", message: "Unexpected server error." } }, { status: 500 });
}
