import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { createServiceClient } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const CreateStoreAccountRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  storeId: z.string().uuid()
});

const PatchAccountRequest = z.object({
  userId: z.string().min(1),
  action: z.enum(["ban", "unban", "force_password_reset"])
});

export async function POST(request: NextRequest) {
  const admin = await requireAdminAuth();
  const body = CreateStoreAccountRequest.parse(await request.json());
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    app_metadata: { role: "store", store_id: body.storeId, must_change_password: true }
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "CREATE_FAILED" }, { status: 400 });
  }
  await writeAuditLog({
    action: "SYSTEM_EVENT",
    actorType: "admin",
    actorId: admin.userId,
    detail: { event: "store_account_created", userId: data.user.id, storeId: body.storeId }
  });
  return NextResponse.json({ userId: data.user.id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminAuth();
  const body = PatchAccountRequest.parse(await request.json());
  const supabase = createServiceClient();
  const banDuration = body.action === "ban" ? "876000h" : body.action === "unban" ? "none" : undefined;
  const appMetadata = body.action === "force_password_reset" ? { must_change_password: true } : undefined;
  const { error } = await supabase.auth.admin.updateUserById(body.userId, {
    ban_duration: banDuration,
    app_metadata: appMetadata
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await writeAuditLog({
    action: "SYSTEM_EVENT",
    actorType: "admin",
    actorId: admin.userId,
    detail: { event: body.action, userId: body.userId }
  });
  return NextResponse.json({ ok: true });
}
