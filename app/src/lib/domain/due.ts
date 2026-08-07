import type { PlanHours } from "@/contracts/common";

const HOUR_MS = 60 * 60 * 1000;

export function calculateReturnDueAt(storageStartedAt: Date, planHours: PlanHours) {
  return new Date(storageStartedAt.getTime() + planHours * HOUR_MS);
}

export function slotEnd(arrivalSlotStart: Date, planHours: PlanHours) {
  return calculateReturnDueAt(arrivalSlotStart, planHours);
}

export function formatHoChiMinhTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function isSlotWithinBusinessHours(slotStartHour: number, planHours: PlanHours, openTime: string, closeTime: string) {
  const openHour = Number(openTime.slice(0, 2));
  const closeHour = closeTime === "24:00" ? 24 : Number(closeTime.slice(0, 2));
  return slotStartHour >= openHour && slotStartHour + planHours <= closeHour;
}
