import { AppError } from "@/lib/errors";
import type { PaymentIntent, PaymentIntentRequest, PaymentProvider } from "@/lib/payment/types";

export class TwoC2PPaymentProvider implements PaymentProvider {
  async createPaymentIntent(_request: PaymentIntentRequest): Promise<PaymentIntent> {
    throw new AppError("INTERNAL", "2C2P provider is not configured yet.");
  }

  async capture(_providerPaymentId: string): Promise<PaymentIntent> {
    throw new AppError("INTERNAL", "2C2P provider is not configured yet.");
  }

  async refund(_providerPaymentId: string, _amountVnd: bigint): Promise<PaymentIntent> {
    throw new AppError("INTERNAL", "2C2P provider is not configured yet.");
  }
}
