import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingItems, bookings } from "@/db/schema";
import { VerifyDropoffRequest, VerifyDropoffResponse } from "@/contracts/store";
import { checkOtp } from "@/lib/domain/otp";
import { requireStoreStaff } from "@/lib/auth/store-auth";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, routeError } from "@/lib/store-api";

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStoreStaff();
    const body = VerifyDropoffRequest.parse(await request.json());
    const now = new Date();

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.bookingToken, body.bookingToken), eq(bookings.storeId, staff.storeId)))
      .limit(1);

    if (!booking) {
      return jsonError("BOOKING_NOT_FOUND", 404);
    }

    if (booking.status !== "paid") {
      return jsonError("INVALID_TRANSITION", 409, { status: booking.status });
    }

    const otpResult = await checkOtp(
      { otp: body.otp, otpHash: booking.dropoffOtpHash },
      { failCount: booking.otpFailCount, lockedUntil: booking.otpLockedUntil },
      now
    );

    if (!otpResult.ok) {
      await db
        .update(bookings)
        .set({ otpFailCount: otpResult.failCount, otpLockedUntil: otpResult.lockedUntil })
        .where(eq(bookings.id, booking.id));
      await writeAuditLog({
        action: "OTP_VERIFY_FAIL",
        actorType: "staff",
        actorId: staff.staffId,
        bookingId: booking.id,
        detail: { purpose: "dropoff", code: otpResult.code }
      });
      return jsonError(otpResult.code, otpResult.code === "OTP_LOCKED" ? 423 : 401);
    }

    await db
      .update(bookings)
      .set({ otpFailCount: 0, otpLockedUntil: null })
      .where(eq(bookings.id, booking.id));
    await writeAuditLog({
      action: "OTP_VERIFIED",
      actorType: "staff",
      actorId: staff.staffId,
      bookingId: booking.id,
      detail: { purpose: "dropoff" }
    });

    const items = await db
      .select({ id: bookingItems.id, size: bookingItems.size })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, booking.id));

    return NextResponse.json(
      VerifyDropoffResponse.parse({
        bookingNo: booking.bookingNo,
        planHours: booking.planHours,
        items
      })
    );
  } catch (error) {
    return routeError(error);
  }
}
