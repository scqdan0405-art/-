import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

export type OtpCheckState = {
  failCount: number;
  lockedUntil: Date | null;
};

export type OtpCheckResult =
  | { ok: true; failCount: 0; lockedUntil: null }
  | { ok: false; code: "OTP_INVALID"; failCount: number; lockedUntil: Date | null }
  | { ok: false; code: "OTP_LOCKED"; failCount: number; lockedUntil: Date };

export function generateOtp(random = randomInt) {
  return random(0, 1_000_000).toString().padStart(6, "0");
}

export async function hashOtp(otp: string, cost = 10) {
  return bcrypt.hash(otp, cost);
}

export async function verifyOtp(otp: string, otpHash: string) {
  return bcrypt.compare(otp, otpHash);
}

export async function checkOtp(
  input: { otp: string; otpHash: string; expiresAt?: Date; usedAt?: Date | null },
  state: OtpCheckState,
  now: Date,
  options = { maxFailures: 5, lockMinutes: 15, countExpiredAsFailure: false }
): Promise<OtpCheckResult> {
  if (state.lockedUntil && state.lockedUntil > now) {
    return { ok: false, code: "OTP_LOCKED", failCount: state.failCount, lockedUntil: state.lockedUntil };
  }

  if (input.usedAt || (input.expiresAt && input.expiresAt <= now)) {
    return { ok: false, code: "OTP_INVALID", failCount: state.failCount, lockedUntil: null };
  }

  const matches = await verifyOtp(input.otp, input.otpHash);
  if (matches) {
    return { ok: true, failCount: 0, lockedUntil: null };
  }

  const failCount = state.failCount + 1;
  if (failCount >= options.maxFailures) {
    return {
      ok: false,
      code: "OTP_LOCKED",
      failCount,
      lockedUntil: new Date(now.getTime() + options.lockMinutes * 60 * 1000)
    };
  }

  return { ok: false, code: "OTP_INVALID", failCount, lockedUntil: null };
}
