import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PaymentIntent, PaymentIntentRequest, PaymentProvider, PaymentWebhookResult } from "@/lib/payment/types";

export class TwoC2PPaymentProvider implements PaymentProvider {
  async createPayment(request: PaymentIntentRequest): Promise<PaymentIntent> {
    assertConfigured();
    const providerPaymentId = `2c2p_${request.bookingId}_${request.idempotencyKey}`;
    const checkoutUrl = new URL(twoc2pHostedBaseUrl());
    checkoutUrl.searchParams.set("merchant_id", env.TWOC2P_MERCHANT_ID!);
    checkoutUrl.searchParams.set("payment_id", providerPaymentId);
    checkoutUrl.searchParams.set("amount_vnd", request.amountVnd.toString());
    checkoutUrl.searchParams.set("currency", request.currency);
    checkoutUrl.searchParams.set("method", request.method);
    if (request.returnUrl) {
      checkoutUrl.searchParams.set("return_url", request.returnUrl);
    }

    return {
      provider: "2c2p",
      providerPaymentId,
      status: "requires_action",
      amountVnd: request.amountVnd,
      currency: request.currency,
      checkoutUrl: checkoutUrl.toString()
    };
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    return this.createPayment(request);
  }

  async verifyWebhook(payload: unknown, signature?: string | null): Promise<PaymentWebhookResult> {
    assertConfigured();
    const body = TwoC2PWebhookPayload.parse(payload);
    if (!verifySignature(body, signature)) {
      throw new AppError("FORBIDDEN", "Invalid 2C2P webhook signature.");
    }

    return {
      providerPaymentId: body.providerPaymentId,
      status: body.status,
      amountVnd: BigInt(body.amountVnd),
      currency: "VND"
    };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentIntent> {
    assertConfigured();
    return {
      provider: "2c2p",
      providerPaymentId,
      status: "requires_action",
      amountVnd: 0n,
      currency: "VND"
    };
  }

  async capture(providerPaymentId: string): Promise<PaymentIntent> {
    assertConfigured();
    return {
      provider: "2c2p",
      providerPaymentId,
      status: "captured",
      amountVnd: 0n,
      currency: "VND"
    };
  }

  async refund(providerPaymentId: string, amountVnd: bigint): Promise<PaymentIntent> {
    assertConfigured();
    return {
      provider: "2c2p",
      providerPaymentId,
      status: "captured",
      amountVnd,
      currency: "VND"
    };
  }
}

const TwoC2PWebhookPayload = z.object({
  providerPaymentId: z.string().min(1),
  status: z.enum(["requires_action", "authorized", "captured", "failed"]),
  amountVnd: z.number().int().nonnegative()
});

function assertConfigured() {
  if (!env.TWOC2P_MERCHANT_ID || !env.TWOC2P_SECRET_KEY) {
    throw new AppError("INTERNAL", "2C2P provider is not configured. Set TWOC2P_MERCHANT_ID and TWOC2P_SECRET_KEY.");
  }
}

function twoc2pHostedBaseUrl() {
  return env.TWOC2P_ENV === "production"
    ? "https://payment.2c2p.com/hosted-payment"
    : "https://sandbox-pgw.2c2p.com/hosted-payment";
}

function verifySignature(body: z.infer<typeof TwoC2PWebhookPayload>, signature?: string | null) {
  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", env.TWOC2P_SECRET_KEY!)
    .update(`${body.providerPaymentId}.${body.status}.${body.amountVnd}`)
    .digest("hex");
  const actual = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
