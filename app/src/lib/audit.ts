import { createServiceClient } from "@/lib/db";

export type AuditAction = "booking.created" | "booking.updated" | "payment.created" | "auth.otp_verified" | "system.event";

export type AuditLogInput = {
  action: AuditAction;
  actorId?: string;
  targetTable?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditLogInput) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_logs").insert({
    action: input.action,
    actor_id: input.actorId ?? null,
    target_table: input.targetTable ?? null,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {}
  });

  if (error) {
    throw error;
  }
}
