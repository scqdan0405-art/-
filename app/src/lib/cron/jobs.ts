import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, bookingItems, bookings, capacityHolds } from "@/db/schema";
import { calculateOvertime } from "@/lib/domain/overtime";
import { isNoShowCandidate, shouldMarkAbandoned, shouldMarkOverdue, shouldRequestReview } from "@/lib/domain/cron";
import { noShowRefund } from "@/lib/domain/state-machine";
import { writeAuditLog, type AuditAction } from "@/lib/audit";

async function hasAudit(action: AuditAction, bookingId: string, itemId?: string) {
  const where = itemId
    ? and(eq(auditLogs.action, action), eq(auditLogs.bookingId, bookingId), eq(auditLogs.itemId, itemId))
    : and(eq(auditLogs.action, action), eq(auditLogs.bookingId, bookingId));
  const [row] = await db.select({ id: auditLogs.id }).from(auditLogs).where(where).limit(1);
  return Boolean(row);
}

export async function runCronJobs(now = new Date()) {
  const result = {
    noShowCancelled: 0,
    overdueStarted: 0,
    overdueNotice24h: 0,
    overdueNotice72h: 0,
    abandonedMarked: 0,
    reviewRequested: 0
  };

  const paidBookings = await db.select().from(bookings).where(eq(bookings.status, "paid"));
  for (const booking of paidBookings) {
    if (!isNoShowCandidate(booking.arrivalSlotStart, booking.status, now) || (await hasAudit("NO_SHOW_CANCELLED", booking.id))) {
      continue;
    }

    const refundAmountVnd = noShowRefund(booking.totalAmountVnd);
    await db.update(bookings).set({
      status: "cancelled",
      cancelledReason: "no_show",
      refundAmountVnd,
      refundStatus: refundAmountVnd > 0 ? "pending" : "none"
    }).where(eq(bookings.id, booking.id));
    await db
      .update(capacityHolds)
      .set({ released: true, releasedAt: now })
      .where(and(eq(capacityHolds.bookingId, booking.id), eq(capacityHolds.released, false)));
    await writeAuditLog({
      action: "NO_SHOW_CANCELLED",
      actorType: "system",
      bookingId: booking.id,
      detail: { refundAmountVnd }
    });
    result.noShowCancelled += 1;
  }

  const storedRows = await db
    .select({
      bookingId: bookings.id,
      returnDueAt: bookings.returnDueAt,
      itemId: bookingItems.id,
      itemStatus: bookingItems.status
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .where(and(eq(bookings.status, "active"), eq(bookingItems.status, "stored")));

  for (const row of storedRows) {
    if (!shouldMarkOverdue(row.returnDueAt, row.itemStatus, now)) {
      continue;
    }

    const fees = calculateOvertime(row.returnDueAt!, now);
    await db
      .update(bookingItems)
      .set({
        status: "overdue",
        overtimeFeeVnd: fees.overtimeFeeVnd,
        dailyStorageFeeVnd: fees.dailyStorageFeeVnd
      })
      .where(eq(bookingItems.id, row.itemId));
    if (!(await hasAudit("OVERDUE_STARTED", row.bookingId, row.itemId))) {
      await writeAuditLog({
        action: "OVERDUE_STARTED",
        actorType: "system",
        bookingId: row.bookingId,
        itemId: row.itemId,
        detail: fees
      });
      result.overdueStarted += 1;
    }
  }

  const overdueRows = await db
    .select({
      bookingId: bookings.id,
      returnDueAt: bookings.returnDueAt,
      itemId: bookingItems.id,
      itemStatus: bookingItems.status
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .where(and(eq(bookings.status, "active"), eq(bookingItems.status, "overdue")));

  for (const row of overdueRows) {
    if (!row.returnDueAt) {
      continue;
    }

    const overdueMs = now.getTime() - row.returnDueAt.getTime();
    if (overdueMs >= 24 * 60 * 60 * 1000 && !(await hasAudit("OVERDUE_NOTICE_24H", row.bookingId, row.itemId))) {
      await writeAuditLog({ action: "OVERDUE_NOTICE_24H", actorType: "system", bookingId: row.bookingId, itemId: row.itemId });
      result.overdueNotice24h += 1;
    }
    if (overdueMs >= 72 * 60 * 60 * 1000 && !(await hasAudit("OVERDUE_NOTICE_72H", row.bookingId, row.itemId))) {
      await writeAuditLog({ action: "OVERDUE_NOTICE_72H", actorType: "system", bookingId: row.bookingId, itemId: row.itemId });
      result.overdueNotice72h += 1;
    }
    if (shouldMarkAbandoned(row.returnDueAt, row.itemStatus, now) && !(await hasAudit("ABANDONED_MARKED", row.bookingId, row.itemId))) {
      await db.update(bookingItems).set({ status: "abandoned" }).where(eq(bookingItems.id, row.itemId));
      await writeAuditLog({ action: "ABANDONED_MARKED", actorType: "system", bookingId: row.bookingId, itemId: row.itemId });
      result.abandonedMarked += 1;
    }
  }

  const completedRows = await db
    .select({
      bookingId: bookings.id,
      status: bookings.status,
      returnedAt: bookingItems.returnedAt
    })
    .from(bookings)
    .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
    .where(and(eq(bookings.status, "completed"), lte(bookingItems.returnedAt, now)));

  const latestReturnedAtByBooking = new Map<string, Date>();
  for (const row of completedRows) {
    if (!row.returnedAt) {
      continue;
    }
    const current = latestReturnedAtByBooking.get(row.bookingId);
    if (!current || row.returnedAt > current) {
      latestReturnedAtByBooking.set(row.bookingId, row.returnedAt);
    }
  }

  for (const [bookingId, completedAt] of latestReturnedAtByBooking) {
    if (shouldRequestReview(completedAt, "completed", now) && !(await hasAudit("REVIEW_REQUESTED", bookingId))) {
      await writeAuditLog({ action: "REVIEW_REQUESTED", actorType: "system", bookingId });
      result.reviewRequested += 1;
    }
  }

  return result;
}
