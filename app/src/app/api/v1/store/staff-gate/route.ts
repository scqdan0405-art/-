import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { staff } from "@/db/schema";
import { STAFF_CODE_COOKIE, STAFF_GATE_SECONDS, requireStoreAuth } from "@/lib/auth/store-auth";
import { isValidStaffCodeFormat } from "@/lib/auth/staff-code";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const context = await requireStoreAuth();
  const body = (await request.json().catch(() => null)) as { staffCode?: string } | null;
  const staffCode = body?.staffCode ?? "";

  if (!isValidStaffCodeFormat(staffCode)) {
    return NextResponse.json({ code: "STAFF_CODE_INVALID" }, { status: 403 });
  }

  const [row] = await db
    .select({ id: staff.id, displayName: staff.displayName, isActive: staff.isActive })
    .from(staff)
    .where(and(eq(staff.storeId, context.storeId), eq(staff.staffCode, staffCode)))
    .limit(1);

  if (!row?.isActive) {
    await writeAuditLog({
      actorType: "staff",
      action: "STAFF_CODE_DENIED",
      detail: { reason: "invalid_or_inactive", storeId: context.storeId }
    });

    return NextResponse.json({ code: "STAFF_CODE_INVALID" }, { status: 403 });
  }

  await writeAuditLog({
    actorType: "staff",
    actorId: row.id,
    action: "STAFF_CODE_VERIFIED",
    detail: { storeId: context.storeId }
  });

  const response = NextResponse.json({ ok: true, staff: { displayName: row.displayName } });
  response.cookies.set(STAFF_CODE_COOKIE, staffCode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STAFF_GATE_SECONDS
  });

  return response;
}
