import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payment";
import { isPaidPaymentStatus, markBookingPaid } from "@/lib/payment/finalize";
import { AppError, toErrorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const signature = request.headers.get("x-payment-signature") ?? request.headers.get("x-2c2p-signature");
    const payment = await getPaymentProvider().verifyWebhook(payload, signature);

    if (!isPaidPaymentStatus(payment.status)) {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    const result = await markBookingPaid({
      providerPaymentId: payment.providerPaymentId,
      amountVnd: payment.amountVnd,
      issueNewDropoffOtp: true
    });

    if (!result.ok) {
      if (result.code === "BOOKING_NOT_FOUND") {
        throw new AppError("BAD_REQUEST", "Payment reference was not found.");
      }
      throw new AppError("CONFLICT", result.code);
    }

    return NextResponse.json({ ok: true, bookingNo: result.booking.bookingNo, alreadyPaid: result.alreadyPaid });
  } catch (error) {
    return toErrorResponse(error);
  }
}
