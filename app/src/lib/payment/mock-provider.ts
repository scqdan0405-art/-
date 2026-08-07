import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { PaymentIntent, PaymentIntentRequest, PaymentProvider, PaymentWebhookResult } from "@/lib/payment/types";

export class MockPaymentProvider implements PaymentProvider {
  async createPayment(request: PaymentIntentRequest): Promise<PaymentIntent> {
    if (request.paymentToken?.endsWith("4000")) {
      return {
        provider: "mock",
        providerPaymentId: mockPaymentId("failed", request),
        status: "failed",
        amountVnd: request.amountVnd,
        currency: request.currency
      };
    }

    return {
      provider: "mock",
      providerPaymentId: mockPaymentId(request.method, request),
      status: "authorized",
      amountVnd: request.amountVnd,
      currency: request.currency
    };
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    return this.createPayment(request);
  }

  async verifyWebhook(payload: unknown, signature?: string | null): Promise<PaymentWebhookResult> {
    const body = MockWebhookPayload.parse(payload);
    if (!verifyMockSignature(body, signature)) {
      throw new AppError("FORBIDDEN", "Invalid mock payment webhook signature.");
    }

    return {
      providerPaymentId: body.providerPaymentId,
      status: body.status,
      amountVnd: BigInt(body.amountVnd),
      currency: "VND"
    };
  }

  async getStatus(providerPaymentId: string): Promise<PaymentIntent> {
    return {
      provider: "mock",
      providerPaymentId,
      status: providerPaymentId.includes("_failed_") ? "failed" : "captured",
      amountVnd: 0n,
      currency: "VND"
    };
  }

  async capture(providerPaymentId: string): Promise<PaymentIntent> {
    return {
      provider: "mock",
      providerPaymentId,
      status: "captured",
      amountVnd: 0n,
      currency: "VND"
    };
  }

  async refund(providerPaymentId: string, amountVnd: bigint): Promise<PaymentIntent> {
    return {
      provider: "mock",
      providerPaymentId,
      status: "captured",
      amountVnd,
      currency: "VND"
    };
  }
}

const MockWebhookPayload = z.object({
  providerPaymentId: z.string().min(1),
  status: z.enum(["requires_action", "authorized", "captured", "failed"]),
  amountVnd: z.number().int().nonnegative()
});

function mockPaymentId(kind: string, request: PaymentIntentRequest) {
  return `mock_${kind}_${request.bookingId}_${request.idempotencyKey}`;
}

function verifyMockSignature(body: z.infer<typeof MockWebhookPayload>, signature?: string | null) {
  if (!signature) {
    return false;
  }

  const secret = env.PAYMENT_WEBHOOK_SECRET ?? (env.NODE_ENV === "test" ? "test_payment_webhook_secret" : null);
  if (!secret) {
    throw new AppError("INTERNAL", "PAYMENT_WEBHOOK_SECRET is required for mock payment webhooks.");
  }

  const expected = createHmac("sha256", secret)
    .update(`${body.providerPaymentId}.${body.status}.${body.amountVnd}`)
    .digest("hex");
  const actual = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
