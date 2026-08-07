import { describe, expect, it } from "vitest";
import { calculateReturnDueAt, formatHoChiMinhTime, isSlotWithinBusinessHours } from "./due";

describe("due date specs/12 T1-T3", () => {
  it("T1 calculates 6h return due at ICT and UTC", () => {
    const due = calculateReturnDueAt(new Date("2026-07-27T02:15:00.000Z"), 6);
    expect(due.toISOString()).toBe("2026-07-27T08:15:00.000Z");
  });

  it("T2 supports overnight 12h plan", () => {
    const due = calculateReturnDueAt(new Date("2026-07-27T13:00:00.000Z"), 12);
    expect(due.toISOString()).toBe("2026-07-28T01:00:00.000Z");
  });

  it("T3 formats display in Asia/Ho_Chi_Minh", () => {
    expect(formatHoChiMinhTime(new Date("2026-07-27T08:15:00.000Z"))).toBe("15:15");
  });

  it("filters slots that cross closing time", () => {
    expect(isSlotWithinBusinessHours(20, 3, "09:00", "22:00")).toBe(false);
    expect(isSlotWithinBusinessHours(19, 3, "09:00", "22:00")).toBe(true);
  });
});
