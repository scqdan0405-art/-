import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, pickupOtps } from "@/db/schema";
import { RequestPickupOtpRequest, RequestPickupOtpResponse } from "@/contracts/store";
import { requireStoreStaff } from "@/lib/auth/store-auth";
import { generateOtp, hashOtp } from "@/lib/domain/otp";
import { assertRateLimit } from "@/lib/rate-limit";
import { sendPickupOtp } from "@/lib/notifications";
import { addMinutes, jsonError, routeError } from "@/lib/store-api";
import { writeAuditLog } from "@/lib/audit";

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) {
    return email;
  }
  return `${name.slice(0, 2)}***@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStoreStaff();
    const body = RequestPickupOtpRequest.parse(await request.json());
    assertRateLimit({ key: `pickup-otp:${body.bookingToken}`, limit: 3, windowMs: 15 * 60 * 1000 });

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.bookingToken, body.bookingToken), eq(bookings.storeId, staff.storeId)))
      .limit(1);

    if (!booking) {
      return jsonError("BOOKING_NOT_FOUND", 404);
    }

    if (booking.status !== "active") {
      return jsonError("INVALID_TRANSITION", 409, { status: booking.status });
    }

    const now = new Date();
    const otp = generateOtp();
    const expiresAt = addMinutes(now, 10);
    await db
      .update(pickupOtps)
      .set({ usedAt: now, otpPlain: null })
      .where(and(eq(pickupOtps.bookingId, booking.id), isNull(pickupOtps.usedAt), gt(pickupOtps.expiresAt, now)));
    await db.insert(pickupOtps).values({
      bookingId: booking.id,
      otpHash: await hashOtp(otp),
      otpPlain: otp,
      expiresAt
    });

    await sendPickupOtp({ email: booking.email, bookingNo: booking.bookingNo, pickupOtp: otp, expiresAt });
    await writeAuditLog({
      action: "PICKUP_OTP_REQUESTED",
      actorType: "staff",
      actorId: staff.staffId,
      bookingId: booking.id
    });

    return NextResponse.json(RequestPickupOtpResponse.parse({ sentTo: maskEmail(booking.email) }));
  } catch (error) {
    return routeError(error);
  }
}
