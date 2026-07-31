import { randomInt } from "node:crypto";

const WEAK_CODES = new Set(["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321"]);

export function isValidStaffCodeFormat(code: string) {
  return /^\d{4}$/.test(code);
}

export function isWeakStaffCode(code: string) {
  if (!isValidStaffCodeFormat(code)) {
    return true;
  }

  if (WEAK_CODES.has(code)) {
    return true;
  }

  const digits = [...code].map(Number);
  const ascending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] + 1);
  const descending = digits.every((digit, index) => index === 0 || digit === digits[index - 1] - 1);

  return ascending || descending;
}

export function generateStaffCode(existingCodes: Iterable<string>, random = randomInt) {
  const used = new Set(existingCodes);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = random(0, 10000).toString().padStart(4, "0");
    if (!used.has(candidate) && !isWeakStaffCode(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a safe staff code.");
}
