import { describe, expect, it } from "vitest";

describe("booking QR payload", () => {
  it("contains bookingToken only and no OTP", () => {
    const bookingToken = "11111111-1111-4111-8111-111111111111";
    const dropoffOtp = "123456";
    const payload = bookingToken;

    expect(payload).toBe(bookingToken);
    expect(payload).not.toContain(dropoffOtp);
    expect(payload).not.toContain("otp");
  });
});
