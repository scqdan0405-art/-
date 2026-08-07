import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingItems, bookings, stores } from "@/db/schema";
import { DailyResponse } from "@/contracts/admin";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { csvResponse, toDateRange } from "@/lib/admin/helpers";

export async function GET(request: NextRequest) {
  await requireAdminAuth();
  const { fromDate, toDate } = toDateRange(request.nextUrl.searchParams);
  const storeId = request.nextUrl.searchParams.get("storeId");

  const rows = await db
    .select({
      date: bookings.visitDate,
      storeId: stores.id,
      storeCode: stores.code,
      bookingStatus: bookings.status,
      channel: bookings.channel,
      channelCode: bookings.channelCode,
      totalVnd: bookings.totalAmountVnd,
      itemStatus: bookingItems.status,
      size: bookingItems.size
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .innerJoin(stores, eq(bookings.storeId, stores.id))
    .where(and(gte(bookings.createdAt, fromDate), lte(bookings.createdAt, toDate)));

  const groups = new Map<string, {
    date: string;
    storeCode: string;
    storedCount: number;
    sizeS: number;
    sizeM: number;
    sizeL: number;
    completedCount: number;
    cancelledCount: number;
    overdueStartedCount: number;
    grossVnd: number;
    channel: string;
    channelCode: string | null;
  }>();

  for (const row of rows.filter((row) => !storeId || row.storeId === storeId)) {
    const key = `${row.date}:${row.storeCode}:${row.channel}:${row.channelCode ?? ""}`;
    const current =
      groups.get(key) ??
      {
        date: row.date,
        storeCode: row.storeCode,
        storedCount: 0,
        sizeS: 0,
        sizeM: 0,
        sizeL: 0,
        completedCount: 0,
        cancelledCount: 0,
        overdueStartedCount: 0,
        grossVnd: 0,
        channel: row.channel,
        channelCode: row.channelCode
      };
    if (row.itemStatus === "stored" || row.itemStatus === "overdue" || row.itemStatus === "returned") {
      current.storedCount += 1;
    }
    if (row.size === "S") current.sizeS += 1;
    if (row.size === "M") current.sizeM += 1;
    if (row.size === "L") current.sizeL += 1;
    if (row.bookingStatus === "completed") current.completedCount += 1;
    if (row.bookingStatus === "cancelled") current.cancelledCount += 1;
    if (row.itemStatus === "overdue") current.overdueStartedCount += 1;
    if (["paid", "active", "completed"].includes(row.bookingStatus)) current.grossVnd += row.totalVnd;
    groups.set(key, current);
  }

  const parsed = DailyResponse.parse([...groups.values()]);
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return csvResponse("daily-report.csv", parsed);
  }

  return NextResponse.json(parsed);
}
