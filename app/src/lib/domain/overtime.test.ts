import { describe, expect, it } from "vitest";
import { calculateOvertime } from "./overtime";

const due = new Date("2026-07-27T00:00:00.000Z");

function afterMinutes(minutes: number) {
  return new Date(due.getTime() + minutes * 60 * 1000);
}

describe("overtime specs/12 O1-O10", () => {
  it.each([
    ["O1", 0, 0],
    ["O2", 10, 0],
    ["O3", 15, 0],
    ["O4", 16, 10_000],
    ["O5", 30, 10_000],
    ["O6", 180, 30_000],
    ["O7", 210, 40_000],
    ["O8", 181, 40_000],
    ["O9", 1440, 240_000],
    ["O10", 1800, 240_000]
  ])("%s calculates overtime fee", (_caseId, minutes, expected) => {
    expect(calculateOvertime(due, afterMinutes(minutes)).overtimeFeeVnd).toBe(expected);
  });
});

describe("daily storage specs/12 D1-D4", () => {
  it.each([
    ["D1", 24 * 60, 240_000],
    ["D2", 24 * 60 + 1, 290_000],
    ["D3", 48 * 60 + 1, 340_000]
  ])("%s adds configured daily storage fee", (_caseId, minutes, expected) => {
    expect(calculateOvertime(due, afterMinutes(minutes), { graceMinutes: 15, hourlyVnd: 10_000, capHours: 24, dailyStorageFeeVnd: 50_000 }).totalVnd).toBe(expected);
  });

  it("D4 treats null daily storage fee as zero", () => {
    expect(calculateOvertime(due, afterMinutes(48 * 60 + 1), { graceMinutes: 15, hourlyVnd: 10_000, capHours: 24, dailyStorageFeeVnd: null }).totalVnd).toBe(240_000);
  });
});
