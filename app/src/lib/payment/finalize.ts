import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { generateOtp, hashOtp } from "@/lib/domain/otp";
import { sendBookingConfirmation } from "@/lib/notifications";
import { env } from "@/lib/env";
import type { Locale } from "@/contracts/common";
import type { PaymentWebhookResult } from "@/lib/payment/types";

export async function markBookingPaid(input: {
  bookingId?: string;
  providerPaymentId: string;
  amountVnd: bigint;
  issueNewDropoffOtp?: boolean;
}) {
  const where = input.bookingId ? eq(bookings.id, input.bookingId) : eq(bookings.paymentRef, input.providerPaymentId);
  const [booking] = await db.select().from(bookings).where(where).limit(1);
  if (!booking) {
    return { ok: false as const, code: "BOOKING_NOT_FOUND" };
  }

  if (booking.paymentRef !== input.providerPaymentId || booking.totalAmountVnd !== Number(input.amountVnd)) {
    return { ok: false as const, code: "PAYMENT_MISMATCH" };
  }

  if (booking.status === "paid") {
    return { ok: true as const, booking, alreadyPaid: true };
  }

  if (booking.status !== "pending_payment") {
    return { ok: false as const, code: "INVALID_TRANSITION" };
  }

  const dropoffOtp = input.issueNewDropoffOtp ? generateOtp() : null;
  const [paidBooking] = await db
    .update(bookings)
    .set({
      status: "paid",
      dropoffOtpHash: dropoffOtp ? await hashOtp(dropoffOtp, 10) : booking.dropoffOtpHash
    })
    .where(eq(bookings.id, booking.id))
    .returning();

  if (dropoffOtp) {
    await sendBookingConfirmation({
      email: paidBooking.email,
      locale: paidBooking.locale as Locale,
      bookingNo: paidBooking.bookingNo,
      bookingUrl: `${env.APP_BASE_URL}/b/${paidBooking.bookingToken}`,
      dropoffOtp,
      totalVnd: paidBooking.totalAmountVnd
    });
  }

  return { ok: true as const, booking: paidBooking, alreadyPaid: false };
}

export function isPaidPaymentStatus(status: PaymentWebhookResult["status"]) {
  return status === "authorized" || status === "captured";
}
