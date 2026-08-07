import { describe, expect, it } from "vitest";
import { bookingTotal, sizeAdjustment } from "./pricing";

describe("pricing table specs/12 P1-P6", () => {
  it.each([
    ["P1", [{ size: "S" as const }], 3, 50_000],
    ["P2", [{ size: "S" as const }, { size: "S" as const }], 6, 140_000],
    ["P3", [{ size: "M" as const }], 12, 150_000],
    ["P4", [{ size: "L" as const }, { size: "S" as const, planHours: 3 as const }], 12, 250_000],
    ["P5", [{ size: "L" as const }, { size: "L" as const }, { size: "L" as const }], 12, 600_000],
    ["P6", [{ size: "M" as const, planHours: 3 as const }, { size: "M" as const, planHours: 6 as const }], 3, 170_000]
  ])("%s returns expected VND total", (_caseId, items, planHours, expected) => {
    expect(bookingTotal(items, planHours as 3 | 6 | 12)).toBe(expected);
  });
});

describe("size adjustment specs/12.10-B G1-G2", () => {
  it("G1 S 6h to M charges +30,000", () => {
    expect(sizeAdjustment("S", "M", 6)).toBe(30_000);
  });

  it("G2 L 3h to S records -50,000", () => {
    expect(sizeAdjustment("L", "S", 3)).toBe(-50_000);
  });
});
