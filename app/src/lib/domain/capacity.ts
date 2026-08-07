import type { Size } from "@/contracts/common";

export const CAPACITY_POINTS: Record<Size, number> = { S: 1, M: 2, L: 3 };

export type CapacityHold = {
  points: number;
  occupyStart: Date;
  occupyEnd: Date;
  released?: boolean;
};

export function pointsForItems(items: { size: Size }[]) {
  return items.reduce((sum, item) => sum + CAPACITY_POINTS[item.size], 0);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function occupiedPoints(holds: CapacityHold[], start: Date, end: Date) {
  return holds
    .filter((hold) => !hold.released && overlaps(start, end, hold.occupyStart, hold.occupyEnd))
    .reduce((sum, hold) => sum + hold.points, 0);
}

export function canReserve(capacityPoints: number, holds: CapacityHold[], start: Date, end: Date, newPoints: number) {
  const overlapping = holds.filter((hold) => !hold.released && overlaps(start, end, hold.occupyStart, hold.occupyEnd));
  const used = overlapping.reduce((sum, hold) => sum + hold.points, 0);
  const hasOvernightCarry = overlapping.some(
    (hold) => hold.occupyStart.getUTCDate() !== hold.occupyEnd.getUTCDate() && start >= startOfUtcDay(hold.occupyEnd)
  );

  if (hasOvernightCarry && used + newPoints >= capacityPoints) {
    return false;
  }

  return used + newPoints <= capacityPoints;
}

export function availablePoints(capacityPoints: number, holds: CapacityHold[], start: Date, end: Date) {
  return Math.max(0, capacityPoints - occupiedPoints(holds, start, end));
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
