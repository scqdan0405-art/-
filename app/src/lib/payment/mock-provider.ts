import type { PaymentIntent, PaymentIntentRequest, PaymentProvider } from "@/lib/payment/types";

export class MockPaymentProvider implements PaymentProvider {
  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    return {
      provider: "mock",
      providerPaymentId: `mock_${request.bookingId}_${request.idempotencyKey}`,
      status: "authorized",
      amountVnd: request.amountVnd,
      currency: request.currency
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
