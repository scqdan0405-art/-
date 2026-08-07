import { z } from "zod";
import { BookingNo, BookingStatus, BookingToken, IsoUtc, ItemStatus, Otp, PlanHours, Size, Vnd } from "./common";

export const VerifyDropoffRequest = z.object({ bookingToken: BookingToken, otp: Otp });
export const VerifyDropoffResponse = z.object({
  bookingNo: BookingNo,
  planHours: PlanHours,
  items: z.array(z.object({ id: z.string().uuid(), size: Size }))
});

export const CheckinRequest = z.object({
  bookingId: z.string().uuid(),
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      tagNo: z.string().min(1),
      photoBase64: z.string(),
      sizeOverride: Size.optional()
    })
  ).min(1)
});
export const CheckinResponse = z.object({
  returnDueAt: IsoUtc,
  sizeAdjustmentVnd: z.number().int()
});

export const RequestPickupOtpRequest = z.object({ bookingToken: BookingToken });
export const RequestPickupOtpResponse = z.object({ sentTo: z.string() });

export const CheckoutRequest = z.object({
  bookingToken: BookingToken,
  pickupOtp: Otp,
  itemIds: z.array(z.string().uuid()).min(1),
  overtimeSettled: z.boolean().optional()
});
export const CheckoutResponse = z.object({
  returnedItemIds: z.array(z.string().uuid()),
  bookingStatus: BookingStatus
});

export const StoreItemsResponse = z.array(
  z.object({
    bookingNo: BookingNo,
    tagNo: z.string().nullable(),
    size: Size,
    returnDueAt: IsoUtc.nullable(),
    status: ItemStatus,
    overtimeFeeVnd: Vnd
  })
);

export type VerifyDropoffRequest = z.infer<typeof VerifyDropoffRequest>;
export type VerifyDropoffResponse = z.infer<typeof VerifyDropoffResponse>;
export type CheckinRequest = z.infer<typeof CheckinRequest>;
export type CheckinResponse = z.infer<typeof CheckinResponse>;
export type CheckoutRequest = z.infer<typeof CheckoutRequest>;
export type CheckoutResponse = z.infer<typeof CheckoutResponse>;
