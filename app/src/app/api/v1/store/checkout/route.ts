import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingItems, bookings, capacityHolds, pickupOtps } from "@/db/schema";
import { CheckoutRequest, CheckoutResponse } from "@/contracts/store";
import { requireStoreStaff } from "@/lib/auth/store-auth";
import { checkOtp } from "@/lib/domain/otp";
import { assertItemTransition, bookingStatusAfterCheckout } from "@/lib/domain/state-machine";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, routeError } from "@/lib/store-api";
import type { BookingStatus, ItemStatus } from "@/contracts/common";

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStoreStaff();
    const body = CheckoutRequest.parse(await request.json());
    const now = new Date();

    const response = await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(and(eq(bookings.bookingToken, body.bookingToken), eq(bookings.storeId, staff.storeId)))
        .limit(1);

      if (!booking) {
        return { kind: "error" as const, code: "BOOKING_NOT_FOUND", status: 404 };
      }

      if (booking.status !== "active") {
        return { kind: "error" as const, code: "INVALID_TRANSITION", status: 409, detail: { status: booking.status } };
      }

      const [pickupOtp] = await tx
        .select()
        .from(pickupOtps)
        .where(and(eq(pickupOtps.bookingId, booking.id), isNull(pickupOtps.usedAt), gt(pickupOtps.expiresAt, now)))
        .orderBy(desc(pickupOtps.createdAt))
        .limit(1);

      if (!pickupOtp) {
        return { kind: "error" as const, code: "OTP_INVALID", status: 401 };
      }

      const otpResult = await checkOtp(
        { otp: body.pickupOtp, otpHash: pickupOtp.otpHash, expiresAt: pickupOtp.expiresAt, usedAt: pickupOtp.usedAt },
        { failCount: booking.otpFailCount, lockedUntil: booking.otpLockedUntil },
        now
      );

      if (!otpResult.ok) {
        await tx
          .update(bookings)
          .set({ otpFailCount: otpResult.failCount, otpLockedUntil: otpResult.lockedUntil })
          .where(eq(bookings.id, booking.id));
        await writeAuditLog({
          action: "OTP_VERIFY_FAIL",
          actorType: "staff",
          actorId: staff.staffId,
          bookingId: booking.id,
          detail: { purpose: "pickup", code: otpResult.code }
        });
        return { kind: "error" as const, code: otpResult.code, status: otpResult.code === "OTP_LOCKED" ? 423 : 401 };
      }

      const selectedItems = await tx
        .select()
        .from(bookingItems)
        .where(and(eq(bookingItems.bookingId, booking.id), inArray(bookingItems.id, body.itemIds)));

      if (selectedItems.length !== new Set(body.itemIds).size) {
        return { kind: "error" as const, code: "ITEM_NOT_FOUND", status: 404 };
      }

      for (const item of selectedItems) {
        const transition = assertItemTransition(item.status as ItemStatus, "returned", body.overtimeSettled === true);
        if (!transition.ok) {
          return { kind: "error" as const, code: transition.code, status: transition.code === "OVERTIME_UNSETTLED" ? 409 : 409 };
        }
      }

      await tx
        .update(bookingItems)
        .set({ status: "returned", returnedAt: now, overtimeSettled: body.overtimeSettled === true })
        .where(and(eq(bookingItems.bookingId, booking.id), inArray(bookingItems.id, body.itemIds)));
      await tx.update(pickupOtps).set({ usedAt: now, otpPlain: null }).where(eq(pickupOtps.id, pickupOtp.id));

      const allItems = await tx.select({ id: bookingItems.id, status: bookingItems.status }).from(bookingItems).where(eq(bookingItems.bookingId, booking.id));
      const returnedIds = new Set(body.itemIds);
      const nextItemStatuses = allItems.map((item) => (returnedIds.has(item.id) ? "returned" : item.status)) as ItemStatus[];
      const nextBookingStatus = bookingStatusAfterCheckout(nextItemStatuses) as BookingStatus;

      await tx
        .update(bookings)
        .set({ status: nextBookingStatus, otpFailCount: 0, otpLockedUntil: null })
        .where(eq(bookings.id, booking.id));

      if (nextBookingStatus === "completed") {
        await tx
          .update(capacityHolds)
          .set({ released: true, releasedAt: now })
          .where(and(eq(capacityHolds.bookingId, booking.id), eq(capacityHolds.released, false)));
      }

      await writeAuditLog({
        action: "CHECKOUT_COMPLETED",
        actorType: "staff",
        actorId: staff.staffId,
        bookingId: booking.id,
        detail: { itemIds: body.itemIds, bookingStatus: nextBookingStatus }
      });
      await writeAuditLog({
        action: "ITEM_RETURNED",
        actorType: "staff",
        actorId: staff.staffId,
        bookingId: booking.id,
        detail: { itemIds: body.itemIds }
      });

      return {
        kind: "ok" as const,
        payload: CheckoutResponse.parse({
          returnedItemIds: body.itemIds,
          bookingStatus: nextBookingStatus
        })
      };
    });

    if (response.kind === "error") {
      return jsonError(response.code, response.status, response.detail);
    }

    return NextResponse.json(response.payload);
  } catch (error) {
    return routeError(error);
  }
}
