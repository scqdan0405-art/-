import type { PlanHours, Size } from "@/contracts/common";

export type PriceTable = Record<Size, Record<PlanHours, number>>;

export const DEFAULT_PRICE_TABLE: PriceTable = {
  S: { 3: 50_000, 6: 70_000, 12: 100_000 },
  M: { 3: 70_000, 6: 100_000, 12: 150_000 },
  L: { 3: 100_000, 6: 150_000, 12: 200_000 }
};

export type PriceItem = {
  size: Size;
  planHours?: PlanHours;
};

export function unitPrice(size: Size, planHours: PlanHours, prices: PriceTable = DEFAULT_PRICE_TABLE) {
  return prices[size][planHours];
}

export function bookingTotal(items: PriceItem[], planHours: PlanHours, prices: PriceTable = DEFAULT_PRICE_TABLE) {
  return items.reduce((sum, item) => sum + unitPrice(item.size, item.planHours ?? planHours, prices), 0);
}

export function quoteLines(items: PriceItem[], planHours: PlanHours, prices: PriceTable = DEFAULT_PRICE_TABLE) {
  return items.map((item) => ({
    size: item.size,
    unitPriceVnd: unitPrice(item.size, item.planHours ?? planHours, prices)
  }));
}

export function sizeAdjustment(reserved: Size, actual: Size, planHours: PlanHours, prices: PriceTable = DEFAULT_PRICE_TABLE) {
  return unitPrice(actual, planHours, prices) - unitPrice(reserved, planHours, prices);
}
