import type { BookingStatus, ItemStatus } from "@/contracts/common";

export type TransitionResult =
  | { ok: true }
  | { ok: false; code: "INVALID_TRANSITION" | "OVERTIME_UNSETTLED"; message: string };

const BOOKING_TRANSITIONS = new Set([
  "pending_payment->paid",
  "paid->active",
  "active->completed",
  "paid->cancelled",
  "pending_payment->payment_failed"
]);

const ITEM_TRANSITIONS = new Set([
  "awaiting_dropoff->stored",
  "stored->returned",
  "stored->overdue",
  "overdue->returned",
  "overdue->abandoned"
]);

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): TransitionResult {
  if (BOOKING_TRANSITIONS.has(`${from}->${to}`)) {
    return { ok: true };
  }
  return { ok: false, code: "INVALID_TRANSITION", message: `Invalid booking transition: ${from} to ${to}.` };
}

export function assertItemTransition(from: ItemStatus, to: ItemStatus, overtimeSettled = false): TransitionResult {
  if (from === "overdue" && to === "returned" && !overtimeSettled) {
    return { ok: false, code: "OVERTIME_UNSETTLED", message: "Overtime must be settled before checkout." };
  }

  if (ITEM_TRANSITIONS.has(`${from}->${to}`)) {
    return { ok: true };
  }
  return { ok: false, code: "INVALID_TRANSITION", message: `Invalid item transition: ${from} to ${to}.` };
}

export function bookingStatusAfterCheckout(itemStatuses: ItemStatus[]) {
  return itemStatuses.every((status) => status === "returned") ? "completed" : "active";
}

export function userCancellationRefund(totalVnd: number, cancellationFeeVnd = 20_000) {
  return Math.max(0, totalVnd - cancellationFeeVnd);
}

export function noShowRefund(totalVnd: number, noShowFeeVnd = 20_000) {
  return Math.max(0, totalVnd - noShowFeeVnd);
}
