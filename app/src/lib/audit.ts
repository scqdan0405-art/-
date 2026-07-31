import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type AuditActorType = "guest" | "staff" | "admin" | "system";

export type AuditAction =
  | "BOOKING_CREATED"
  | "OTP_VERIFY_FAIL"
  | "OTP_VERIFIED"
  | "ITEM_STORED"
  | "ITEM_RETURNED"
  | "STAFF_CODE_DENIED"
  | "STAFF_CODE_VERIFIED"
  | "SYSTEM_EVENT";

export type AuditLogInput = {
  action: AuditAction;
  actorType: AuditActorType;
  actorId?: string;
  bookingId?: string;
  itemId?: string;
  detail?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditLogInput) {
  await db.insert(auditLogs).values({
    action: input.action,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    bookingId: input.bookingId ?? null,
    itemId: input.itemId ?? null,
    detail: input.detail ?? {}
  });
}
