import type { ChannelTier, PlanHours, Size } from "@/contracts/common";

export type PriceTable = Record<ChannelTier, Record<Size, Record<PlanHours, number>>>;

export const DEFAULT_PRICE_TABLE: PriceTable = {
  direct: {
    S: { 3: 50_000, 6: 70_000, 12: 100_000 },
    M: { 3: 70_000, 6: 100_000, 12: 150_000 },
    L: { 3: 100_000, 6: 150_000, 12: 200_000 }
  },
  ota: {
    S: { 3: 50_000, 6: 70_000, 12: 100_000 },
    M: { 3: 70_000, 6: 100_000, 12: 150_000 },
    L: { 3: 100_000, 6: 150_000, 12: 200_000 }
  }
};

export type PriceItem = {
  size: Size;
  planHours?: PlanHours;
};

export function unitPrice(size: Size, planHours: PlanHours, channelTier: ChannelTier = "direct", prices: PriceTable = DEFAULT_PRICE_TABLE) {
  return prices[channelTier][size][planHours];
}

export const price = unitPrice;

export function bookingTotal(items: PriceItem[], planHours: PlanHours, channelTier: ChannelTier = "direct", prices: PriceTable = DEFAULT_PRICE_TABLE) {
  return items.reduce((sum, item) => sum + unitPrice(item.size, item.planHours ?? planHours, channelTier, prices), 0);
}

export function quoteLines(items: PriceItem[], planHours: PlanHours, channelTier: ChannelTier = "direct", prices: PriceTable = DEFAULT_PRICE_TABLE) {
  return items.map((item) => ({
    size: item.size,
    unitPriceVnd: unitPrice(item.size, item.planHours ?? planHours, channelTier, prices)
  }));
}

export function sizeAdjustment(reserved: Size, actual: Size, planHours: PlanHours, channelTier: ChannelTier = "direct", prices: PriceTable = DEFAULT_PRICE_TABLE) {
  return unitPrice(actual, planHours, channelTier, prices) - unitPrice(reserved, planHours, channelTier, prices);
}
