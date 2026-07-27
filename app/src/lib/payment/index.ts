import { env } from "@/lib/env";
import { MockPaymentProvider } from "@/lib/payment/mock-provider";
import { TwoC2PPaymentProvider } from "@/lib/payment/twoc2p-provider";
import type { PaymentProvider } from "@/lib/payment/types";

export function getPaymentProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === "twoc2p") {
    return new TwoC2PPaymentProvider();
  }

  return new MockPaymentProvider();
}

export type { PaymentIntent, PaymentIntentRequest, PaymentProvider } from "@/lib/payment/types";
