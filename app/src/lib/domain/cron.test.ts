import { describe, expect, it } from "vitest";
import { isNoShowCandidate, shouldMarkAbandoned, shouldMarkOverdue, shouldRequestReview } from "./cron";

describe("cron time injection specs/12 N, O, D", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");

  it("N1 marks paid bookings as no-show after the cutoff", () => {
    expect(isNoShowCandidate(new Date("2026-07-27T08:59:59.000Z"), "paid", now)).toBe(true);
    expect(isNoShowCandidate(new Date("2026-07-27T09:01:00.000Z"), "paid", now)).toBe(false);
  });

  it("N2 does not no-show active or completed bookings", () => {
    expect(isNoShowCandidate(new Date("2026-07-27T08:00:00.000Z"), "active", now)).toBe(false);
    expect(isNoShowCandidate(new Date("2026-07-27T08:00:00.000Z"), "completed", now)).toBe(false);
  });

  it("marks overdue only after the 15 minute grace period", () => {
    expect(shouldMarkOverdue(new Date("2026-07-27T11:45:00.000Z"), "stored", now)).toBe(false);
    expect(shouldMarkOverdue(new Date("2026-07-27T11:44:59.000Z"), "stored", now)).toBe(true);
  });

  it("marks abandoned after seven days overdue", () => {
    expect(shouldMarkAbandoned(new Date("2026-07-20T12:00:00.000Z"), "overdue", now)).toBe(true);
    expect(shouldMarkAbandoned(new Date("2026-07-20T12:00:01.000Z"), "overdue", now)).toBe(false);
  });

  it("requests review one hour after completion", () => {
    expect(shouldRequestReview(new Date("2026-07-27T11:00:00.000Z"), "completed", now)).toBe(true);
    expect(shouldRequestReview(new Date("2026-07-27T11:00:01.000Z"), "completed", now)).toBe(false);
  });
});
