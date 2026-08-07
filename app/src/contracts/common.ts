import { z } from "zod";

export const Size = z.enum(["S", "M", "L"]);
export const PlanHours = z.union([z.literal(3), z.literal(6), z.literal(12)]);
export const Locale = z.enum(["en", "vi", "ja", "ko", "zh-CN", "zh-TW", "hi"]);
export const Channel = z.enum(["direct", "organic", "ota", "referral", "store", "sns"]);
export const ChannelCode = z.string().min(1).max(40).optional();
export const ChannelTier = z.enum(["direct", "ota"]);
export const PaymentMethod = z.enum(["card", "apple_pay", "google_pay", "vietqr", "momo"]);

export const BookingStatus = z.enum(["pending_payment", "payment_failed", "paid", "active", "completed", "cancelled"]);
export const ItemStatus = z.enum(["awaiting_dropoff", "stored", "overdue", "returned", "abandoned"]);

export const Vnd = z.number().int().nonnegative();
export const IsoUtc = z.string().datetime();
export const BookingNo = z.string().regex(/^KC-\d{6}$/);
export const BookingToken = z.string().uuid();
export const Otp = z.string().regex(/^\d{6}$/);
export const Phone = z.string().regex(/^\+[1-9]\d{6,14}$/);

export const ErrorCode = z.enum([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "INVALID_TRANSITION",
  "CAPACITY_FULL",
  "OTP_INVALID",
  "OTP_LOCKED",
  "PAYMENT_FAILED",
  "OVERTIME_UNSETTLED",
  "RATE_LIMITED",
  "FORBIDDEN"
]);

export const ApiError = z.object({
  error: ErrorCode,
  message: z.string(),
  details: z.unknown().optional()
});

export type Size = z.infer<typeof Size>;
export type PlanHours = z.infer<typeof PlanHours>;
export type Locale = z.infer<typeof Locale>;
export type Channel = z.infer<typeof Channel>;
export type ChannelCode = z.infer<typeof ChannelCode>;
export type ChannelTier = z.infer<typeof ChannelTier>;
export type PaymentMethod = z.infer<typeof PaymentMethod>;
export type BookingStatus = z.infer<typeof BookingStatus>;
export type ItemStatus = z.infer<typeof ItemStatus>;
export type ApiError = z.infer<typeof ApiError>;
