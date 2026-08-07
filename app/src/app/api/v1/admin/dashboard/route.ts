import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingItems, bookings, feeSettings, stores } from "@/db/schema";
import { DashboardResponse } from "@/contracts/admin";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { revenueBreakdown, toDateRange } from "@/lib/admin/helpers";

export async function GET(request: NextRequest) {
  await requireAdminAuth();
  const { fromDate, toDate } = toDateRange(request.nextUrl.searchParams);

  const rows = await db
    .select({
      bookingId: bookings.id,
      status: bookings.status,
      totalVnd: bookings.totalAmountVnd,
      cancelledReason: bookings.cancelledReason,
      storeId: stores.id,
      storeCode: stores.code,
      storeName: stores.name
    })
    .from(bookings)
    .innerJoin(stores, eq(bookings.storeId, stores.id))
    .where(and(gte(bookings.createdAt, fromDate), lte(bookings.createdAt, toDate)));

  const itemRows = await db
    .select({
      status: bookingItems.status,
      capacityPoints: bookingItems.capacityPoints,
      storeId: stores.id
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .innerJoin(stores, eq(bookings.storeId, stores.id))
    .where(and(gte(bookings.createdAt, fromDate), lte(bookings.createdAt, toDate)));

  const [daily] = await db
    .select({ valueVnd: feeSettings.valueVnd })
    .from(feeSettings)
    .where(eq(feeSettings.key, "daily_storage_fee_vnd"))
    .limit(1);

  const grossRows = rows.filter((row) => ["paid", "active", "completed"].includes(row.status));
  const grossVnd = grossRows.reduce((sum, row) => sum + row.totalVnd, 0);
  const byStore = new Map<string, { storeId: string; storeCode: string; storeName: string; bookings: number; revenueVnd: number; usedPoints: number }>();

  for (const row of rows) {
    const name = row.storeName as Record<string, string>;
    const current =
      byStore.get(row.storeId) ??
      { storeId: row.storeId, storeCode: row.storeCode, storeName: name.ja ?? name.en ?? row.storeCode, bookings: 0, revenueVnd: 0, usedPoints: 0 };
    current.bookings += 1;
    if (["paid", "active", "completed"].includes(row.status)) {
      current.revenueVnd += row.totalVnd;
    }
    byStore.set(row.storeId, current);
  }

  for (const item of itemRows) {
    if (["stored", "overdue"].includes(item.status)) {
      const current = byStore.get(item.storeId);
      if (current) {
        current.usedPoints += item.capacityPoints;
      }
    }
  }

  return NextResponse.json(
    DashboardResponse.parse({
      totalBookings: rows.length,
      activeItems: itemRows.filter((item) => ["stored", "overdue"].includes(item.status)).length,
      revenueVnd: grossVnd,
      completed: rows.filter((row) => row.status === "completed").length,
      noShows: rows.filter((row) => row.cancelledReason === "no_show").length,
      dailyStorageUnset: !daily || daily.valueVnd === null,
      revenueBreakdown: revenueBreakdown(grossVnd),
      byStore: [...byStore.values()].map((row) => ({
        ...row,
        avgUsedPoints: row.bookings === 0 ? 0 : row.usedPoints / row.bookings
      }))
    })
  );
}
