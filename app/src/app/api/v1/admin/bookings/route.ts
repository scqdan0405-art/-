import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auditLogs, bookingItems, bookings, capacityHolds, stores } from "@/db/schema";
import { AdminBookingsResponse } from "@/contracts/admin";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { maskEmail, maskPhone } from "@/lib/admin/helpers";
import { writeAuditLog } from "@/lib/audit";

const AdminBookingActionRequest = z.object({
  bookingId: z.string().uuid(),
  action: z.enum(["cancel_paid", "unlock_otp"]),
  reason: z.string().optional()
});

export async function GET(request: NextRequest) {
  await requireAdminAuth();
  const query = request.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
  const status = request.nextUrl.searchParams.get("status");
  const storeCode = request.nextUrl.searchParams.get("store");

  const baseRows = await db
    .select({
      id: bookings.id,
      bookingNo: bookings.bookingNo,
      storeCode: stores.code,
      status: bookings.status,
      email: bookings.email,
      phone: bookings.phone,
      channel: bookings.channel,
      channelCode: bookings.channelCode,
      totalVnd: bookings.totalAmountVnd,
      createdAt: bookings.createdAt
    })
    .from(bookings)
    .innerJoin(stores, eq(bookings.storeId, stores.id))
    .orderBy(desc(bookings.createdAt))
    .limit(200);

  const filtered = baseRows
    .filter((row) => !status || row.status === status)
    .filter((row) => !storeCode || row.storeCode === storeCode)
    .filter((row) => !query || row.bookingNo.toLowerCase().includes(query) || row.email.toLowerCase().includes(query) || row.phone.includes(query))
    .slice(0, 50);

  const rows = [];
  for (const row of filtered) {
    const items = await db
      .select({
        id: bookingItems.id,
        size: bookingItems.size,
        tagNo: bookingItems.tagNo,
        status: bookingItems.status,
        photoUrl: bookingItems.photoUrl
      })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, row.id));
    const audits = await db
      .select({
        at: auditLogs.at,
        action: auditLogs.action,
        actorType: auditLogs.actorType,
        detail: auditLogs.detail
      })
      .from(auditLogs)
      .where(eq(auditLogs.bookingId, row.id))
      .orderBy(desc(auditLogs.at))
      .limit(30);

    rows.push({
      id: row.id,
      bookingNo: row.bookingNo,
      storeCode: row.storeCode,
      status: row.status,
      emailMasked: maskEmail(row.email),
      phoneMasked: maskPhone(row.phone),
      channel: row.channel,
      channelCode: row.channelCode,
      totalVnd: row.totalVnd,
      createdAt: row.createdAt.toISOString(),
      items,
      audits: audits.map((audit) => ({ ...audit, at: audit.at.toISOString() }))
    });
  }

  return NextResponse.json(AdminBookingsResponse.parse({ rows, pageSize: 50 }));
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminAuth();
  const body = AdminBookingActionRequest.parse(await request.json());
  const now = new Date();

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, body.bookingId)).limit(1);
  if (!booking) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (body.action === "unlock_otp") {
    await db.update(bookings).set({ otpFailCount: 0, otpLockedUntil: null }).where(eq(bookings.id, booking.id));
    await writeAuditLog({
      action: "SYSTEM_EVENT",
      actorType: "admin",
      actorId: admin.userId,
      bookingId: booking.id,
      detail: { event: "otp_unlocked" }
    });
    return NextResponse.json({ ok: true });
  }

  if (booking.status !== "paid") {
    return NextResponse.json({ error: "INVALID_TRANSITION" }, { status: 409 });
  }

  await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledReason: "admin_cancel",
      refundAmountVnd: booking.totalAmountVnd,
      refundStatus: "pending"
    })
    .where(eq(bookings.id, booking.id));
  await db
    .update(capacityHolds)
    .set({ released: true, releasedAt: now })
    .where(and(eq(capacityHolds.bookingId, booking.id), eq(capacityHolds.released, false)));
  await writeAuditLog({
    action: "SYSTEM_EVENT",
    actorType: "admin",
    actorId: admin.userId,
    bookingId: booking.id,
    detail: { event: "admin_cancel", reason: body.reason ?? null, refundAmountVnd: booking.totalAmountVnd }
  });

  return NextResponse.json({ ok: true });
}
