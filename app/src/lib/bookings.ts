import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { bookingItems, bookings, pickupOtps, stores } from "@/db/schema";
import { db } from "@/db/client";
import { BookingView } from "@/contracts/user";
import { writeAuditLog } from "@/lib/audit";

export async function loadBookingView(token: string, options: { auditPickupOtpView?: boolean } = {}) {
  const [booking] = await db
    .select({
      id: bookings.id,
      bookingNo: bookings.bookingNo,
      status: bookings.status,
      storeArea: stores.area,
      planHours: bookings.planHours,
      totalVnd: bookings.totalAmountVnd,
      returnDueAt: bookings.returnDueAt
    })
    .from(bookings)
    .innerJoin(stores, eq(bookings.storeId, stores.id))
    .where(eq(bookings.bookingToken, token))
    .limit(1);

  if (!booking) {
    return null;
  }

  const items = await db
    .select({
      id: bookingItems.id,
      size: bookingItems.size,
      status: bookingItems.status,
      tagNo: bookingItems.tagNo,
      overtimeFeeVnd: bookingItems.overtimeFeeVnd
    })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, booking.id));

  const [pickupOtp] = await db
    .select({ otp: pickupOtps.otpPlain, expiresAt: pickupOtps.expiresAt })
    .from(pickupOtps)
    .where(and(eq(pickupOtps.bookingId, booking.id), isNull(pickupOtps.usedAt), gt(pickupOtps.expiresAt, new Date())))
    .orderBy(pickupOtps.createdAt)
    .limit(1);

  if (pickupOtp?.otp && options.auditPickupOtpView) {
    await writeAuditLog({
      actorType: "guest",
      action: "PICKUP_OTP_VIEWED",
      bookingId: booking.id,
      detail: { source: "booking_page" }
    });
  }

  return BookingView.parse({
    bookingNo: booking.bookingNo,
    status: booking.status,
    storeArea: booking.storeArea,
    planHours: booking.planHours,
    totalVnd: Number(booking.totalVnd),
    items: items.map((item) => ({
      id: item.id,
      size: item.size,
      status: item.status,
      tagNo: item.tagNo,
      returnDueAt: booking.returnDueAt?.toISOString() ?? null,
      overtimeFeeVnd: Number(item.overtimeFeeVnd)
    })),
    returnDueAt: booking.returnDueAt?.toISOString() ?? null,
    activePickupOtp: pickupOtp?.otp ? { otp: pickupOtp.otp, expiresAt: pickupOtp.expiresAt.toISOString() } : null
  });
}
