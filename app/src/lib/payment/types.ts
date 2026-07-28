export type PaymentProviderName = "mock" | "2c2p";

export type PaymentIntentRequest = {
  bookingId: string;
  amountVnd: bigint;
  currency: "VND";
  idempotencyKey: string;
};

export type PaymentIntent = {
  provider: PaymentProviderName;
  providerPaymentId: string;
  status: "requires_action" | "authorized" | "captured" | "failed";
  amountVnd: bigint;
  currency: "VND";
  checkoutUrl?: string;
};

export interface PaymentProvider {
  createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent>;
  capture(providerPaymentId: string): Promise<PaymentIntent>;
  refund(providerPaymentId: string, amountVnd: bigint): Promise<PaymentIntent>;
}
