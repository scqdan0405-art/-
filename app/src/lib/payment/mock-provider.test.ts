import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { MockPaymentProvider } from "@/lib/payment/mock-provider";
import type { PaymentMethod } from "@/lib/payment/types";

describe("MockPaymentProvider", () => {
  it.each<PaymentMethod>(["card", "apple_pay", "google_pay", "vietqr", "momo"])("authorizes %s mock VND payments", async (method) => {
    const provider = new MockPaymentProvider();

    const intent = await provider.createPaymentIntent({
      bookingId: "booking_1",
      amountVnd: 120000n,
      currency: "VND",
      idempotencyKey: "idem_1",
      method
    });

    expect(intent).toMatchObject({
      provider: "mock",
      status: "authorized",
      amountVnd: 120000n,
      currency: "VND"
    });
  });

  it("fails mock payments when the token ends with 4000", async () => {
    const provider = new MockPaymentProvider();
    const intent = await provider.createPaymentIntent({
      bookingId: "booking_1",
      amountVnd: 50_000n,
      currency: "VND",
      idempotencyKey: "idem_1",
      method: "card",
      paymentToken: "tok_4000"
    });

    expect(intent.status).toBe("failed");
  });

  it("verifies signed mock webhook payloads and rejects unsigned payloads", async () => {
    const provider = new MockPaymentProvider();
    const payload = { providerPaymentId: "mock_card_booking_1_idem_1", status: "captured" as const, amountVnd: 50_000 };
    const signature = createHmac("sha256", "test_payment_webhook_secret")
      .update(`${payload.providerPaymentId}.${payload.status}.${payload.amountVnd}`)
      .digest("hex");

    await expect(provider.verifyWebhook(payload, signature)).resolves.toMatchObject({
      providerPaymentId: payload.providerPaymentId,
      status: "captured",
      amountVnd: 50_000n
    });
    await expect(provider.verifyWebhook(payload, null)).rejects.toThrow("Invalid mock payment webhook signature.");
  });
});
