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
import type { PaymentIntent } from "@/lib/payment";
import { sendBookingConfirmation } from "@/lib/notifications";
import { resolveSalesChannel } from "@/lib/domain/channels";
import { env } from "@/lib/env";

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
    const resolvedChannel = await resolveSalesChannel({ channel: body.channel, channelCode: body.channelCode });
    const prices = await loadCurrentPriceTable(body.visitDate);
    const lines = quoteLines(body.items, body.planHours, "direct", prices);
    const totalVnd = bookingTotal(body.items, body.planHours, "direct", prices);
    const arrivalStart = new Date(body.arrivalSlotStart);
    const occupyEnd = slotEnd(arrivalStart, body.planHours);
    const newPoints = pointsForItems(body.items);
    const dropoffOtp = generateOtp();
    const dropoffOtpHash = await hashOtp(dropoffOtp, 10);
    const paymentProviderName = env.PAYMENT_PROVIDER;

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
          paymentProvider: paymentProviderName,
          dropoffOtpHash,
          disclaimerAcceptedAt: new Date(),
          channel: resolvedChannel.channel,
          channelCode: resolvedChannel.channelCode,
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

      const payment = await executePayment(paymentProviderName, {
        bookingId: booking.id,
        amountVnd: BigInt(totalVnd),
        currency: "VND",
        idempotencyKey,
        method: body.payment.method,
        paymentToken: body.payment.token,
        returnUrl: `${env.APP_BASE_URL}/b/${booking.bookingToken}`
      });

      if (payment.status === "failed") {
        await tx.update(bookings).set({ status: "payment_failed", paymentRef: payment.providerPaymentId }).where(eq(bookings.id, booking.id));
        await tx.update(capacityHolds).set({ released: true, releasedAt: new Date() }).where(eq(capacityHolds.id, hold.id));
        throw new RouteError("PAYMENT_FAILED", "Payment was declined.");
      }

      if (payment.status === "requires_action") {
        await tx.update(bookings).set({ paymentRef: payment.providerPaymentId }).where(eq(bookings.id, booking.id));
        return CreateBookingResponse.parse({
          bookingNo: booking.bookingNo,
          bookingToken: booking.bookingToken,
          dropoffOtp,
          payment: {
            status: payment.status,
            redirectUrl: payment.checkoutUrl
          }
        });
      }

      const [paidBooking] = await tx
        .update(bookings)
        .set({ status: "paid", paymentRef: payment.providerPaymentId })
        .where(eq(bookings.id, booking.id))
        .returning();

      return CreateBookingResponse.parse({
        bookingNo: paidBooking.bookingNo,
        bookingToken: paidBooking.bookingToken,
        dropoffOtp,
        payment: {
          status: payment.status,
          redirectUrl: payment.checkoutUrl
        }
      });
    });

    if (payload.payment?.status !== "requires_action") {
      const bookingUrl = `${env.APP_BASE_URL}/b/${payload.bookingToken}`;
      await sendBookingConfirmation({
        email: body.email,
        locale: body.locale,
        bookingNo: payload.bookingNo,
        bookingUrl,
        dropoffOtp,
        totalVnd
      });
    }

    return NextResponse.json(rememberIdempotentResponse(idempotencyKey, payload), { status: 201 });
  } catch (error) {
    if (error instanceof RouteError) {
      return apiError(error.code, error.message);
    }
    return validationError(error);
  }
}

type PaymentInput = {
  bookingId: string;
  amountVnd: bigint;
  currency: "VND";
  idempotencyKey: string;
  method: "card" | "apple_pay" | "google_pay" | "vietqr" | "momo";
  paymentToken: string;
  returnUrl: string;
};

async function executePayment(paymentProvider: string, input: PaymentInput): Promise<PaymentIntent> {
  if (paymentProvider === "ota_voucher") {
    // TODO(level2): validate and redeem ota_vouchers, then merge into the paid booking path.
    return {
      provider: "mock",
      providerPaymentId: `ota_voucher_${input.bookingId}_${input.idempotencyKey}`,
      status: "authorized",
      amountVnd: input.amountVnd,
      currency: input.currency
    };
  }

  return getPaymentProvider().createPayment(input);
}

class RouteError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CAPACITY_FULL" | "PAYMENT_FAILED",
    message: string
  ) {
    super(message);
  }
}
