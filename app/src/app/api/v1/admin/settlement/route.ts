import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, stores } from "@/db/schema";
import { SettlementResponse } from "@/contracts/admin";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { csvResponse, revenueBreakdown } from "@/lib/admin/helpers";

function monthRange(month: string | null) {
  const value = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const from = new Date(`${value}-01T00:00:00.000Z`);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);
  return { label: value, from, to };
}

export async function GET(request: NextRequest) {
  await requireAdminAuth();
  const { label, from, to } = monthRange(request.nextUrl.searchParams.get("month"));

  const rows = await db
    .select({
      storeId: stores.id,
      storeCode: stores.code,
      storeName: stores.name,
      status: bookings.status,
      channel: bookings.channel,
      channelCode: bookings.channelCode,
      totalVnd: bookings.totalAmountVnd
    })
    .from(bookings)
    .innerJoin(stores, eq(bookings.storeId, stores.id))
    .where(and(gte(bookings.createdAt, from), lt(bookings.createdAt, to)));

  const groups = new Map<string, { storeId: string; storeCode: string; storeName: string; channel: string; channelCode: string | null; grossVnd: number }>();
  for (const row of rows.filter((row) => ["paid", "active", "completed"].includes(row.status) && ["direct", "organic", "ota", "referral", "store", "sns"].includes(row.channel))) {
    const name = row.storeName as Record<string, string>;
    const key = `${row.storeId}:${row.channel}:${row.channelCode ?? ""}`;
    const current =
      groups.get(key) ??
      { storeId: row.storeId, storeCode: row.storeCode, storeName: name.ja ?? name.en ?? row.storeCode, channel: row.channel, channelCode: row.channelCode, grossVnd: 0 };
    current.grossVnd += row.totalVnd;
    groups.set(key, current);
  }

  const payload = [...groups.values()].map((group) => {
    const breakdown = revenueBreakdown(group.grossVnd);
    return {
      ...group,
      commission40Vnd: breakdown.storeCommission40Vnd,
      paymentFee3Vnd: breakdown.paymentFee3Vnd,
      insurance6Vnd: breakdown.insurance6Vnd,
      system5Vnd: breakdown.system5Vnd,
      netVnd: breakdown.estimatedNetVnd
    };
  });

  const parsed = SettlementResponse.parse(payload);
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return csvResponse(`settlement-${label}.csv`, parsed);
  }

  return NextResponse.json(parsed);
}
