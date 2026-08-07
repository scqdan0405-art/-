import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bookingItems, bookings, capacityHolds, stores } from "@/db/schema";
import { CheckinRequest, CheckinResponse } from "@/contracts/store";
import { requireStoreStaff } from "@/lib/auth/store-auth";
import { pointsForItems } from "@/lib/domain/capacity";
import { calculateReturnDueAt } from "@/lib/domain/due";
import { parseRequiredItemPhoto } from "@/lib/domain/photos";
import { sizeAdjustment } from "@/lib/domain/pricing";
import { uploadItemPhoto } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, routeError } from "@/lib/store-api";
import type { PlanHours, Size } from "@/contracts/common";

function asPlanHours(value: number): PlanHours {
  if (value === 3 || value === 6 || value === 12) {
    return value;
  }

  throw new Error("INVALID_PLAN_HOURS");
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStoreStaff();
    const body = CheckinRequest.parse(await request.json());
    const now = new Date();
    const photos = new Map(
      body.items.map((item) => [item.itemId, parseRequiredItemPhoto(item.photoBase64)])
    );
    const photoUrls = new Map<string, string>();
    for (const [itemId, photo] of photos) {
      photoUrls.set(itemId, await uploadItemPhoto({ bookingId: body.bookingId, itemId, photo, now }));
    }

    const response = await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, body.bookingId), eq(bookings.storeId, staff.storeId)))
        .limit(1);

      if (!booking) {
        return { kind: "error" as const, code: "BOOKING_NOT_FOUND", status: 404 };
      }

      await tx.execute(sql`select id from ${stores} where id = ${booking.storeId} for update`);

      if (booking.status !== "paid") {
        return { kind: "error" as const, code: "INVALID_TRANSITION", status: 409, detail: { status: booking.status } };
      }

      const existingItems = await tx.select().from(bookingItems).where(eq(bookingItems.bookingId, booking.id));
      const expectedIds = new Set(existingItems.map((item) => item.id));
      const providedIds = new Set(body.items.map((item) => item.itemId));
      const allItemsProvided =
        expectedIds.size === providedIds.size && [...expectedIds].every((itemId) => providedIds.has(itemId));
      if (!allItemsProvided || existingItems.some((item) => item.status !== "awaiting_dropoff")) {
        return { kind: "error" as const, code: "ALL_ITEMS_REQUIRED", status: 409 };
      }

      const planHours = asPlanHours(booking.planHours);
      const byId = new Map(existingItems.map((item) => [item.id, item]));
      let totalAdjustment = 0;
      const updated = body.items.map((item) => {
        const existing = byId.get(item.itemId);
        if (!existing) {
          throw new Error("ITEM_NOT_FOUND");
        }

        const actualSize = (item.sizeOverride ?? existing.size) as Size;
        const adjustment = sizeAdjustment(existing.size as Size, actualSize, planHours);
        totalAdjustment += adjustment;
        return {
          itemId: item.itemId,
          actualSize,
          adjustment,
          capacityPoints: pointsForItems([{ size: actualSize }]),
          photoUrl: photoUrls.get(item.itemId) ?? null,
          tagNo: item.tagNo
        };
      });
      const totalPoints = updated.reduce((sum, item) => sum + item.capacityPoints, 0);
      const returnDueAt = calculateReturnDueAt(now, planHours);

      const [store] = await tx.select().from(stores).where(eq(stores.id, booking.storeId)).limit(1);
      if (!store || totalPoints > store.capacityPoints) {
        return { kind: "error" as const, code: "CAPACITY_FULL", status: 409 };
      }

      await tx
        .update(bookings)
        .set({
          status: "active",
          storageStartedAt: now,
          returnDueAt,
          totalAmountVnd: booking.totalAmountVnd + totalAdjustment
        })
        .where(eq(bookings.id, booking.id));

      await tx
        .update(capacityHolds)
        .set({ points: totalPoints, occupyStart: now, occupyEnd: returnDueAt })
        .where(and(eq(capacityHolds.bookingId, booking.id), eq(capacityHolds.released, false)));

      for (const item of updated) {
        await tx
          .update(bookingItems)
          .set({
            size: item.actualSize,
            capacityPoints: item.capacityPoints,
            status: "stored",
            tagNo: item.tagNo,
            photoUrl: item.photoUrl,
            storedAt: now,
            sizeAdjustmentVnd: item.adjustment
          })
          .where(eq(bookingItems.id, item.itemId));
      }

      await writeAuditLog({
        action: "CHECKIN_COMPLETED",
        actorType: "staff",
        actorId: staff.staffId,
        bookingId: booking.id,
        detail: { itemIds: updated.map((item) => item.itemId), totalAdjustment }
      });
      await writeAuditLog({
        action: "ITEM_STORED",
        actorType: "staff",
        actorId: staff.staffId,
        bookingId: booking.id,
        detail: { count: updated.length }
      });

      return {
        kind: "ok" as const,
        payload: CheckinResponse.parse({
          returnDueAt: returnDueAt.toISOString(),
          sizeAdjustmentVnd: totalAdjustment
        })
      };
    });

    if (response.kind === "error") {
      return jsonError(response.code, response.status, response.detail);
    }

    return NextResponse.json(response.payload);
  } catch (error) {
    return routeError(error);
  }
}
