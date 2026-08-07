import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "@/lib/payment/mock-provider";

describe("MockPaymentProvider", () => {
  it("authorizes a mock VND payment intent", async () => {
    const provider = new MockPaymentProvider();

    const intent = await provider.createPaymentIntent({
      bookingId: "booking_1",
      amountVnd: 120000n,
      currency: "VND",
      idempotencyKey: "idem_1"
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
      paymentToken: "tok_4000"
    });

    expect(intent.status).toBe("failed");
  });
});
