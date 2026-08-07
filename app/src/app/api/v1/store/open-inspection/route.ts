import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { requireStoreStaff } from "@/lib/auth/store-auth";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, routeError } from "@/lib/store-api";

const OpenInspectionRequest = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStoreStaff();
    const body = OpenInspectionRequest.parse(await request.json());

    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.id, body.bookingId), eq(bookings.storeId, staff.storeId)))
      .limit(1);

    if (!booking) {
      return jsonError("BOOKING_NOT_FOUND", 404);
    }

    await writeAuditLog({
      action: "OPEN_INSPECTION",
      actorType: "staff",
      actorId: staff.staffId,
      bookingId: booking.id,
      detail: { reason: body.reason }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
