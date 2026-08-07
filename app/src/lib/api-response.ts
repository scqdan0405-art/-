import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, ErrorCode } from "@/contracts/common";

const STATUS_BY_CODE: Record<keyof typeof ErrorCode.enum, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  CAPACITY_FULL: 409,
  OTP_INVALID: 401,
  OTP_LOCKED: 423,
  PAYMENT_FAILED: 402,
  OVERTIME_UNSETTLED: 409,
  RATE_LIMITED: 429,
  FORBIDDEN: 403
};

export function apiError(error: keyof typeof ErrorCode.enum, message: string, details?: unknown) {
  return NextResponse.json(ApiError.parse({ error, message, details }), { status: STATUS_BY_CODE[error] });
}

export function validationError(error: unknown) {
  if (error instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Invalid request payload.", error.flatten());
  }
  return apiError("VALIDATION_ERROR", "Invalid request payload.");
}
