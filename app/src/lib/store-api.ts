import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export function jsonError(code: string, status: number, detail?: Record<string, unknown>) {
  return NextResponse.json({ code, ...detail }, { status });
}

export function routeError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  if (error instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", 400, { issues: error.issues });
  }

  if (error instanceof AppError) {
    return jsonError(error.code, error.code === "RATE_LIMITED" ? 429 : 400);
  }

  if (error instanceof Error) {
    if (["PHOTO_REQUIRED", "PHOTO_INVALID"].includes(error.message)) {
      return jsonError(error.message, 400);
    }
  }

  return jsonError("INTERNAL_ERROR", 500);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
