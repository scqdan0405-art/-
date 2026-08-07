import { z } from "zod";
import { Channel, ChannelCode, IsoUtc, Size, Vnd } from "./common";

export const AdminRangeQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional()
});

export const DashboardResponse = z.object({
  totalBookings: z.number().int(),
  activeItems: z.number().int(),
  revenueVnd: Vnd,
  completed: z.number().int(),
  noShows: z.number().int(),
  dailyStorageUnset: z.boolean(),
  revenueBreakdown: z.object({
    grossVnd: Vnd,
    storeCommission40Vnd: Vnd,
    paymentFee3Vnd: Vnd,
    insurance6Vnd: Vnd,
    system5Vnd: Vnd,
    estimatedNetVnd: z.number().int()
  }),
  byStore: z.array(
    z.object({
      storeId: z.string().uuid(),
      storeCode: z.string(),
      storeName: z.string(),
      bookings: z.number().int(),
      revenueVnd: Vnd,
      usedPoints: z.number().int(),
      avgUsedPoints: z.number()
    })
  )
});

export const AdminBookingRow = z.object({
  id: z.string().uuid(),
  bookingNo: z.string(),
  storeCode: z.string(),
  status: z.string(),
  emailMasked: z.string(),
  phoneMasked: z.string(),
  channel: Channel,
  channelCode: ChannelCode.nullable(),
  totalVnd: Vnd,
  createdAt: IsoUtc,
  items: z.array(z.object({ id: z.string().uuid(), size: Size, tagNo: z.string().nullable(), status: z.string(), photoUrl: z.string().nullable() })),
  audits: z.array(z.object({ at: IsoUtc, action: z.string(), actorType: z.string(), detail: z.unknown().nullable() }))
});
export const AdminBookingsResponse = z.object({ rows: z.array(AdminBookingRow), pageSize: z.number().int() });

export const SettlementRow = z.object({
  storeId: z.string().uuid(),
  storeCode: z.string(),
  storeName: z.string(),
  channel: Channel,
  channelCode: ChannelCode.nullable(),
  grossVnd: Vnd,
  commission40Vnd: Vnd,
  paymentFee3Vnd: Vnd,
  insurance6Vnd: Vnd,
  system5Vnd: Vnd,
  netVnd: z.number().int()
});
export const SettlementResponse = z.array(SettlementRow);

export const DailyRow = z.object({
  date: z.string().date(),
  storeCode: z.string(),
  storedCount: z.number().int(),
  sizeS: z.number().int(),
  sizeM: z.number().int(),
  sizeL: z.number().int(),
  completedCount: z.number().int(),
  cancelledCount: z.number().int(),
  overdueStartedCount: z.number().int(),
  grossVnd: Vnd,
  channel: Channel,
  channelCode: ChannelCode.nullable()
});
export const DailyResponse = z.array(DailyRow);

export const SalesChannelRequest = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1),
  channelType: Channel,
  commissionRate: z.number().min(0).max(1).default(0),
  supportsVoucher: z.boolean().default(false),
  isActive: z.boolean().default(true)
});
export const SalesChannelResponse = z.array(SalesChannelRequest.extend({ id: z.string().uuid() }));

export const PricePlanRequest = z.object({
  size: Size,
  planHours: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  channelTier: z.enum(["direct", "ota"]),
  priceVnd: Vnd,
  capacityPoints: z.number().int().positive(),
  validFrom: z.string().date()
});

export const FeeSettingRequest = z.object({
  key: z.string().min(1),
  valueVnd: z.number().int().nullable(),
  effectiveFrom: z.string().date(),
  note: z.string().optional()
});

export const MastersResponse = z.object({
  stores: z.array(z.unknown()),
  pricePlans: z.array(z.unknown()),
  feeSettings: z.array(z.unknown()),
  dailyStorageUnset: z.boolean()
});
