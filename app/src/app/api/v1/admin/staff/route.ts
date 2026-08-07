import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { staff, stores } from "@/db/schema";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { generateStaffCode } from "@/lib/auth/staff-code";
import { writeAuditLog } from "@/lib/audit";

const CreateStaffRequest = z.object({
  storeId: z.string().uuid(),
  displayName: z.string().min(1)
});

const PatchStaffRequest = z.object({
  id: z.string().uuid(),
  isActive: z.boolean()
});

export async function GET() {
  await requireAdminAuth();
  const rows = await db
    .select({
      id: staff.id,
      storeId: staff.storeId,
      storeCode: stores.code,
      displayName: staff.displayName,
      staffCode: staff.staffCode,
      isActive: staff.isActive
    })
    .from(staff)
    .innerJoin(stores, eq(staff.storeId, stores.id));
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminAuth();
  const body = CreateStaffRequest.parse(await request.json());
  const existing = await db.select({ code: staff.staffCode }).from(staff).where(eq(staff.storeId, body.storeId));
  const staffCode = generateStaffCode(existing.map((row) => row.code));
  const [row] = await db.insert(staff).values({ storeId: body.storeId, displayName: body.displayName, staffCode }).returning();
  await writeAuditLog({
    action: "SYSTEM_EVENT",
    actorType: "admin",
    actorId: admin.userId,
    detail: { event: "staff_created", staffId: row.id, storeId: body.storeId }
  });
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminAuth();
  const body = PatchStaffRequest.parse(await request.json());
  const [row] = await db.update(staff).set({ isActive: body.isActive }).where(eq(staff.id, body.id)).returning();
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await writeAuditLog({
    action: "SYSTEM_EVENT",
    actorType: "admin",
    actorId: admin.userId,
    detail: { event: body.isActive ? "staff_enabled" : "staff_disabled", staffId: row.id }
  });
  return NextResponse.json(row);
}
