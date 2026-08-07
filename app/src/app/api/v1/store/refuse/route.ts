import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { bookings, capacityHolds } from "@/db/schema";
import { requireStoreStaff } from "@/lib/auth/store-auth";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, routeError } from "@/lib/store-api";

const RefuseRequest = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(1).default("prohibited_item")
});

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStoreStaff();
    const body = RefuseRequest.parse(await request.json());
    const now = new Date();

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, body.bookingId), eq(bookings.storeId, staff.storeId)))
      .limit(1);

    if (!booking) {
      return jsonError("BOOKING_NOT_FOUND", 404);
    }

    if (!["paid", "active"].includes(booking.status)) {
      return jsonError("INVALID_TRANSITION", 409, { status: booking.status });
    }

    const cancellationFee = 20_000;
    const refundAmountVnd = Math.max(booking.totalAmountVnd - cancellationFee, 0);
    await db
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledReason: "prohibited_item",
        refundAmountVnd,
        refundStatus: refundAmountVnd > 0 ? "pending" : "none"
      })
      .where(eq(bookings.id, booking.id));
    await db
      .update(capacityHolds)
      .set({ released: true, releasedAt: now })
      .where(and(eq(capacityHolds.bookingId, booking.id), eq(capacityHolds.released, false)));
    await writeAuditLog({
      action: "PROHIBITED_ITEM_REFUSED",
      actorType: "staff",
      actorId: staff.staffId,
      bookingId: booking.id,
      detail: { reason: body.reason, refundAmountVnd }
    });

    return NextResponse.json({ ok: true, refundAmountVnd });
  } catch (error) {
    return routeError(error);
  }
}
