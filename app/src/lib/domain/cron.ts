const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function noShowCutoff(now: Date, hours = 3) {
  return new Date(now.getTime() - hours * HOUR_MS);
}

export function isNoShowCandidate(arrivalSlotStart: Date, status: string, now: Date) {
  return status === "paid" && arrivalSlotStart <= noShowCutoff(now);
}

export function shouldMarkOverdue(returnDueAt: Date | null, status: string, now: Date, graceMinutes = 15) {
  if (!returnDueAt) {
    return false;
  }
  return status === "stored" && now.getTime() - returnDueAt.getTime() > graceMinutes * MINUTE_MS;
}

export function shouldMarkAbandoned(returnDueAt: Date | null, status: string, now: Date, days = 7) {
  if (!returnDueAt) {
    return false;
  }
  return status === "overdue" && now.getTime() - returnDueAt.getTime() >= days * DAY_MS;
}

export function shouldRequestReview(completedAt: Date | null, status: string, now: Date, delayHours = 1) {
  if (!completedAt) {
    return false;
  }
  return status === "completed" && now.getTime() - completedAt.getTime() >= delayHours * HOUR_MS;
}
