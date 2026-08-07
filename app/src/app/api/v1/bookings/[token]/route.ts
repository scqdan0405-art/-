import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { bookingItems, bookings } from "@/db/schema";
import { db } from "@/db/client";
import { BookingToken } from "@/contracts/common";
import { BookingView, UpdateEmailRequest, UpdateEmailResponse } from "@/contracts/user";
import { apiError, validationError } from "@/lib/api-response";
import { loadBookingView } from "@/lib/bookings";
import { assertRateLimit } from "@/lib/rate-limit";
import { sendEmailChanged } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = {
  params: { token: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const token = BookingToken.parse(context.params.token);
    const view = await loadBookingView(token, { auditPickupOtpView: true });

    if (!view) {
      return apiError("NOT_FOUND", "Booking not found.");
    }

    return NextResponse.json(BookingView.parse(view));
  } catch (error) {
    return validationError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const token = BookingToken.parse(context.params.token);
    const body = UpdateEmailRequest.parse(await request.json());

    assertRateLimit({ key: `email-change:${token}`, limit: 3, windowMs: 60 * 60 * 1000 });

    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingToken, token)).limit(1);
    if (!booking) {
      return apiError("NOT_FOUND", "Booking not found.");
    }

    const items = await db.select({ status: bookingItems.status }).from(bookingItems).where(eq(bookingItems.bookingId, booking.id));
    if (!items.every((item) => item.status === "awaiting_dropoff")) {
      return apiError("INVALID_TRANSITION", "Email can be changed before drop-off only.");
    }

    const oldEmail = booking.email;
    const [updated] = await db.update(bookings).set({ email: body.email }).where(eq(bookings.id, booking.id)).returning();
    const bookingUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/b/${token}`;

    await sendEmailChanged({ oldEmail, newEmail: body.email, bookingNo: booking.bookingNo, bookingUrl });
    await writeAuditLog({
      actorType: "guest",
      action: "EMAIL_CHANGED",
      bookingId: booking.id,
      detail: { oldEmailMasked: maskEmail(oldEmail), newEmailMasked: maskEmail(body.email) }
    });

    return NextResponse.json(UpdateEmailResponse.parse({ email: updated.email }));
  } catch (error) {
    return validationError(error);
  }
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***`;
}
