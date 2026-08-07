import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type AuditActorType = "guest" | "staff" | "admin" | "system";

export type AuditAction =
  | "BOOKING_CREATED"
  | "OTP_VERIFY_FAIL"
  | "OTP_VERIFIED"
  | "CHECKIN_COMPLETED"
  | "ITEM_STORED"
  | "ITEM_RETURNED"
  | "PROHIBITED_ITEM_REFUSED"
  | "OPEN_INSPECTION"
  | "PICKUP_OTP_REQUESTED"
  | "CHECKOUT_COMPLETED"
  | "NO_SHOW_CANCELLED"
  | "OVERDUE_STARTED"
  | "OVERDUE_NOTICE_24H"
  | "OVERDUE_NOTICE_72H"
  | "ABANDONED_MARKED"
  | "REVIEW_REQUESTED"
  | "STAFF_CODE_DENIED"
  | "STAFF_CODE_VERIFIED"
  | "PICKUP_OTP_VIEWED"
  | "EMAIL_CHANGED"
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
