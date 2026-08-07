import { describe, expect, it } from "vitest";
import { checkOtp, hashOtp } from "./otp";

const now = new Date("2026-07-27T00:00:00.000Z");

describe("OTP specs/12 K1-K5", () => {
  it("K1 succeeds after four wrong attempts and resets fail count", async () => {
    const hash = await hashOtp("123456", 4);
    let state = { failCount: 0, lockedUntil: null };
    for (let i = 0; i < 4; i += 1) {
      const result = await checkOtp({ otp: "000000", otpHash: hash }, state, now);
      expect(result.ok).toBe(false);
      state = { failCount: result.failCount, lockedUntil: result.lockedUntil };
    }

    await expect(checkOtp({ otp: "123456", otpHash: hash }, state, now)).resolves.toEqual({
      ok: true,
      failCount: 0,
      lockedUntil: null
    });
  });

  it("K2 locks on fifth wrong attempt", async () => {
    const hash = await hashOtp("123456", 4);
    const result = await checkOtp({ otp: "000000", otpHash: hash }, { failCount: 4, lockedUntil: null }, now);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("OTP_LOCKED");
    expect(result.failCount).toBe(5);
  });

  it("K3 rejects expired pickup OTP without increasing fail count", async () => {
    const hash = await hashOtp("123456", 4);
    const result = await checkOtp({ otp: "123456", otpHash: hash, expiresAt: new Date(now.getTime() - 1) }, { failCount: 2, lockedUntil: null }, now);

    expect(result).toEqual({ ok: false, code: "OTP_INVALID", failCount: 2, lockedUntil: null });
  });

  it("K4 rejects used pickup OTP", async () => {
    const hash = await hashOtp("123456", 4);
    const result = await checkOtp({ otp: "123456", otpHash: hash, usedAt: now }, { failCount: 0, lockedUntil: null }, now);

    expect(result.code).toBe("OTP_INVALID");
  });

  it("K5 rejects drop-off OTP when compared against a distinct pickup hash", async () => {
    const pickupHash = await hashOtp("999999", 4);
    const result = await checkOtp({ otp: "123456", otpHash: pickupHash }, { failCount: 0, lockedUntil: null }, now);

    expect(result.code).toBe("OTP_INVALID");
  });
});
