export type PaymentProviderName = "mock" | "2c2p";
export type PaymentMethod = "card" | "apple_pay" | "google_pay" | "vietqr" | "momo";
export type PaymentStatus = "requires_action" | "authorized" | "captured" | "failed";

export type PaymentIntentRequest = {
  bookingId: string;
  amountVnd: bigint;
  currency: "VND";
  idempotencyKey: string;
  method: PaymentMethod;
  paymentToken?: string;
  returnUrl?: string;
};

export type PaymentIntent = {
  provider: PaymentProviderName;
  providerPaymentId: string;
  status: PaymentStatus;
  amountVnd: bigint;
  currency: "VND";
  checkoutUrl?: string;
  clientToken?: string;
};

export type PaymentWebhookResult = {
  providerPaymentId: string;
  status: PaymentStatus;
  amountVnd: bigint;
  currency: "VND";
};

export interface PaymentProvider {
  createPayment(request: PaymentIntentRequest): Promise<PaymentIntent>;
  createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent>;
  verifyWebhook(payload: unknown, signature?: string | null): Promise<PaymentWebhookResult>;
  getStatus(providerPaymentId: string): Promise<PaymentIntent>;
  capture(providerPaymentId: string): Promise<PaymentIntent>;
  refund(providerPaymentId: string, amountVnd: bigint): Promise<PaymentIntent>;
}
