import { describe, expect, it } from "vitest";
import { canReserve, pointsForItems } from "./capacity";

const cap = 20;

function d(iso: string) {
  return new Date(iso);
}

describe("capacity specs/12 C1-C5", () => {
  it("C1 allows M when overlap total reaches cap exactly", () => {
    expect(canReserve(cap, [{ points: 18, occupyStart: d("2026-07-27T02:00:00Z"), occupyEnd: d("2026-07-27T14:00:00Z") }], d("2026-07-27T02:00:00Z"), d("2026-07-27T14:00:00Z"), pointsForItems([{ size: "M" }]))).toBe(true);
  });

  it("C2 rejects L when overlap exceeds cap", () => {
    expect(canReserve(cap, [{ points: 18, occupyStart: d("2026-07-27T02:00:00Z"), occupyEnd: d("2026-07-27T14:00:00Z") }], d("2026-07-27T02:00:00Z"), d("2026-07-27T14:00:00Z"), pointsForItems([{ size: "L" }]))).toBe(false);
  });

  it("C3 allows non-overlapping late slot", () => {
    expect(canReserve(cap, [{ points: 20, occupyStart: d("2026-07-27T02:00:00Z"), occupyEnd: d("2026-07-27T14:00:00Z") }], d("2026-07-27T15:00:00Z"), d("2026-07-27T18:00:00Z"), pointsForItems([{ size: "S" }]))).toBe(true);
  });

  it("C4 rejects overnight overlap that crosses date boundary", () => {
    expect(canReserve(cap, [{ points: 18, occupyStart: d("2026-07-27T16:00:00Z"), occupyEnd: d("2026-07-28T04:00:00Z") }], d("2026-07-28T01:00:00Z"), d("2026-07-28T04:00:00Z"), pointsForItems([{ size: "M" }]))).toBe(false);
  });

  it("C5 allows L x3 on empty capacity", () => {
    expect(canReserve(cap, [], d("2026-07-27T02:00:00Z"), d("2026-07-27T14:00:00Z"), pointsForItems([{ size: "L" }, { size: "L" }, { size: "L" }]))).toBe(true);
  });
});
