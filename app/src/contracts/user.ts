import { z } from "zod";
import { BookingNo, BookingStatus, BookingToken, Channel, ChannelCode, IsoUtc, ItemStatus, Locale, Otp, PaymentMethod, Phone, PlanHours, Size, Vnd } from "./common";

export const StoresQuery = z.object({ date: z.string().date() });
export const StoreSummary = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.record(Locale, z.string()),
  area: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  openTime: z.string(),
  closeTime: z.string(),
  capacityPoints: z.number().int(),
  availablePoints: z.number().int()
});
export const StoresResponse = z.array(StoreSummary);

export const QuoteRequest = z.object({
  storeId: z.string().uuid(),
  visitDate: z.string().date(),
  planHours: PlanHours,
  items: z.array(z.object({ size: Size })).min(1).max(5),
  insuranceAddonId: z.string().uuid().optional()
});
export const QuoteResponse = z.object({
  itemsTotalVnd: Vnd,
  insuranceAddonVnd: Vnd,
  totalVnd: Vnd,
  lines: z.array(z.object({ size: Size, unitPriceVnd: Vnd })),
  expiresAt: IsoUtc
});

export const CreateBookingRequest = z.object({
  storeId: z.string().uuid(),
  visitDate: z.string().date(),
  arrivalSlotStart: IsoUtc,
  planHours: PlanHours,
  items: z.array(z.object({ size: Size })).min(1).max(5),
  insuranceAddonId: z.string().uuid().optional(),
  email: z.string().email(),
  phone: Phone,
  locale: Locale,
  channel: Channel.optional(),
  channelCode: ChannelCode,
  referralCode: z.string().optional(),
  disclaimerAccepted: z.literal(true),
  prohibitedItemsAcknowledged: z.literal(true),
  ownershipDeclared: z.literal(true),
  payment: z.object({ method: PaymentMethod, token: z.string() })
});
export const CreateBookingResponse = z.object({
  bookingNo: BookingNo,
  bookingToken: BookingToken,
  dropoffOtp: Otp,
  payment: z
    .object({
      status: z.enum(["requires_action", "authorized", "captured", "failed"]),
      redirectUrl: z.string().url().optional()
    })
    .optional()
});

export const ItemView = z.object({
  id: z.string().uuid(),
  size: Size,
  status: ItemStatus,
  tagNo: z.string().nullable(),
  returnDueAt: IsoUtc.nullable(),
  overtimeFeeVnd: Vnd
});
export const BookingView = z.object({
  bookingNo: BookingNo,
  status: BookingStatus,
  storeArea: z.string(),
  planHours: PlanHours,
  totalVnd: Vnd,
  items: z.array(ItemView),
  returnDueAt: IsoUtc.nullable(),
  activePickupOtp: z.object({ otp: Otp, expiresAt: IsoUtc }).nullable()
});

export const UpdateEmailRequest = z.object({ email: z.string().email() });
export const UpdateEmailResponse = z.object({ email: z.string().email() });

export type StoresQuery = z.infer<typeof StoresQuery>;
export type StoreSummary = z.infer<typeof StoreSummary>;
export type QuoteRequest = z.infer<typeof QuoteRequest>;
export type QuoteResponse = z.infer<typeof QuoteResponse>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequest>;
export type CreateBookingResponse = z.infer<typeof CreateBookingResponse>;
export type BookingView = z.infer<typeof BookingView>;
export type UpdateEmailRequest = z.infer<typeof UpdateEmailRequest>;
