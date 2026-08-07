import { and, eq, gte, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { CreateBookingRequest, CreateBookingResponse } from "@/contracts/user";
import { capacityHolds, bookingItems, bookings, stores } from "@/db/schema";
import { db } from "@/db/client";
import { apiError, validationError } from "@/lib/api-response";
import { canReserve, pointsForItems } from "@/lib/domain/capacity";
import { slotEnd } from "@/lib/domain/due";
import { getIdempotentResponse, rememberIdempotentResponse } from "@/lib/domain/idempotency";
import { generateOtp, hashOtp } from "@/lib/domain/otp";
import { bookingTotal, quoteLines } from "@/lib/domain/pricing";
import { loadCurrentPriceTable } from "@/lib/domain/masters";
import { getPaymentProvider } from "@/lib/payment";
import { sendBookingConfirmation } from "@/lib/notifications";

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey) {
    return apiError("VALIDATION_ERROR", "Idempotency-Key header is required.");
  }

  const cached = getIdempotentResponse<unknown>(idempotencyKey);
  if (cached) {
    return NextResponse.json(CreateBookingResponse.parse(cached), { status: 201 });
  }

  try {
    const body = CreateBookingRequest.parse(await request.json());
    const prices = await loadCurrentPriceTable(body.visitDate);
    const lines = quoteLines(body.items, body.planHours, prices);
    const totalVnd = bookingTotal(body.items, body.planHours, prices);
    const arrivalStart = new Date(body.arrivalSlotStart);
    const occupyEnd = slotEnd(arrivalStart, body.planHours);
    const newPoints = pointsForItems(body.items);
    const dropoffOtp = generateOtp();
    const dropoffOtpHash = await hashOtp(dropoffOtp, 10);

    const payload = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${body.storeId}))`);

      const [store] = await tx.select().from(stores).where(eq(stores.id, body.storeId)).limit(1);
      if (!store?.isActive) {
        throw new RouteError("NOT_FOUND", "Store not found.");
      }

      await tx.select({ id: stores.id }).from(stores).where(eq(stores.id, body.storeId)).for("update");

      const holdRows = await tx
        .select()
        .from(capacityHolds)
        .where(and(eq(capacityHolds.storeId, body.storeId), eq(capacityHolds.released, false), lt(capacityHolds.occupyStart, occupyEnd), gte(capacityHolds.occupyEnd, arrivalStart)))
        .for("update");

      if (!canReserve(store.capacityPoints, holdRows, arrivalStart, occupyEnd, newPoints)) {
        throw new RouteError("CAPACITY_FULL", "Store capacity is full for the selected slot.");
      }

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingNo: sql`default` as unknown as string,
          storeId: body.storeId,
          status: "pending_payment",
          email: body.email,
          phone: body.phone,
          locale: body.locale,
          visitDate: body.visitDate,
          arrivalSlotStart: arrivalStart,
          planHours: body.planHours,
          totalAmountVnd: totalVnd,
          paymentProvider: "mock",
          dropoffOtpHash,
          disclaimerAcceptedAt: new Date(),
          channel: body.channel ?? "direct",
          referralCode: body.referralCode,
          externalRef: idempotencyKey,
          insuranceAddonVnd: 0
        })
        .returning();

      await tx.insert(bookingItems).values(
        lines.map((line) => ({
          bookingId: booking.id,
          size: line.size,
          unitPriceVnd: line.unitPriceVnd,
          capacityPoints: pointsForItems([{ size: line.size }])
        }))
      );

      const [hold] = await tx
        .insert(capacityHolds)
        .values({
          storeId: body.storeId,
          bookingId: booking.id,
          points: newPoints,
          occupyStart: arrivalStart,
          occupyEnd
        })
        .returning();

      const payment = await getPaymentProvider().createPaymentIntent({
        bookingId: booking.id,
        amountVnd: BigInt(totalVnd),
        currency: "VND",
        idempotencyKey,
        paymentToken: body.payment.token
      });

      if (payment.status === "failed") {
        await tx.update(bookings).set({ status: "payment_failed", paymentRef: payment.providerPaymentId }).where(eq(bookings.id, booking.id));
        await tx.update(capacityHolds).set({ released: true, releasedAt: new Date() }).where(eq(capacityHolds.id, hold.id));
        throw new RouteError("PAYMENT_FAILED", "Payment was declined.");
      }

      const [paidBooking] = await tx
        .update(bookings)
        .set({ status: "paid", paymentRef: payment.providerPaymentId })
        .where(eq(bookings.id, booking.id))
        .returning();

      return CreateBookingResponse.parse({
        bookingNo: paidBooking.bookingNo,
        bookingToken: paidBooking.bookingToken,
        dropoffOtp
      });
    });

    const bookingUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/b/${payload.bookingToken}`;
    await sendBookingConfirmation({
      email: body.email,
      locale: body.locale,
      bookingNo: payload.bookingNo,
      bookingUrl,
      dropoffOtp,
      totalVnd
    });

    return NextResponse.json(rememberIdempotentResponse(idempotencyKey, payload), { status: 201 });
  } catch (error) {
    if (error instanceof RouteError) {
      return apiError(error.code, error.message);
    }
    return validationError(error);
  }
}

class RouteError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CAPACITY_FULL" | "PAYMENT_FAILED",
    message: string
  ) {
    super(message);
  }
}
