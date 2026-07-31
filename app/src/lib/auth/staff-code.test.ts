import { describe, expect, it } from "vitest";
import { generateStaffCode, isWeakStaffCode } from "./staff-code";

describe("staff code policy", () => {
  it("rejects weak sequences and repeated digits", () => {
    expect(isWeakStaffCode("0000")).toBe(true);
    expect(isWeakStaffCode("1234")).toBe(true);
    expect(isWeakStaffCode("4321")).toBe(true);
    expect(isWeakStaffCode("4826")).toBe(false);
  });

  it("generates a unique four digit code", () => {
    const code = generateStaffCode(["4826"], () => 4827);

    expect(code).toBe("4827");
  });
});
