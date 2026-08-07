import { describe, expect, it } from "vitest";
import { canReserve, type CapacityHold } from "./capacity";

class SerialCapacityBook {
  private lock = Promise.resolve();
  private holds: CapacityHold[];

  constructor(
    private readonly capacityPoints: number,
    holds: CapacityHold[]
  ) {
    this.holds = [...holds];
  }

  reserve(points: number, start: Date, end: Date) {
    const task = this.lock.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (!canReserve(this.capacityPoints, this.holds, start, end, points)) {
        return false;
      }
      this.holds.push({ points, occupyStart: start, occupyEnd: end });
      return true;
    });
    this.lock = task.then(() => undefined);
    return task;
  }
}

describe("capacity race specs/12.4", () => {
  it("allows only one concurrent M reservation when existing overlap is 18 and cap is 20", async () => {
    const start = new Date("2026-07-27T02:00:00.000Z");
    const end = new Date("2026-07-27T14:00:00.000Z");
    const book = new SerialCapacityBook(20, [{ points: 18, occupyStart: start, occupyEnd: end }]);

    const results = await Promise.all([book.reserve(2, start, end), book.reserve(2, start, end)]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((result) => !result)).toHaveLength(1);
  });
});
