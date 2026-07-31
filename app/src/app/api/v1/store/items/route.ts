import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { bookingItems, bookings } from "@/db/schema";
import { db } from "@/db/client";
import { requireStoreStaff } from "@/lib/auth/store-auth";

export async function GET() {
  const context = await requireStoreStaff();

  const rows = await db
    .select({
      itemId: bookingItems.id,
      bookingNo: bookings.bookingNo,
      tagNo: bookingItems.tagNo,
      size: bookingItems.size,
      status: bookingItems.status,
      returnDueAt: bookings.returnDueAt,
      overtimeFeeVnd: bookingItems.overtimeFeeVnd
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .where(and(eq(bookings.storeId, context.storeId), inArray(bookingItems.status, ["stored", "overdue"])))
    .orderBy(sql`${bookings.returnDueAt} asc nulls last`);

  const todayCounters = await db
    .select({
      checkins: sql<number>`count(*) filter (where ${bookingItems.storedAt}::date = current_date)`,
      returns: sql<number>`count(*) filter (where ${bookingItems.returnedAt}::date = current_date)`
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .where(eq(bookings.storeId, context.storeId));

  return NextResponse.json({
    items: rows.map((row) => ({
      ...row,
      overdue: row.status === "overdue" || (row.returnDueAt ? row.returnDueAt.getTime() < Date.now() : false)
    })),
    counters: {
      checkins: Number(todayCounters[0]?.checkins ?? 0),
      returns: Number(todayCounters[0]?.returns ?? 0)
    }
  });
}
