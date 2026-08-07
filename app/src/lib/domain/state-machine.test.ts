import { describe, expect, it } from "vitest";
import { assertBookingTransition, assertItemTransition, bookingStatusAfterCheckout, noShowRefund, userCancellationRefund } from "./state-machine";

describe("state machine specs/12 S1-S9", () => {
  it("allows paid to active checkin and rejects pending payment checkin", () => {
    expect(assertBookingTransition("paid", "active").ok).toBe(true);
    expect(assertBookingTransition("pending_payment", "active").ok).toBe(false);
  });

  it("rejects storing an already stored item", () => {
    expect(assertItemTransition("stored", "stored").ok).toBe(false);
  });

  it("allows stored checkout but rejects awaiting_dropoff checkout", () => {
    expect(assertItemTransition("stored", "returned").ok).toBe(true);
    expect(assertItemTransition("awaiting_dropoff", "returned").ok).toBe(false);
  });

  it("requires overtime settlement before overdue checkout", () => {
    expect(assertItemTransition("overdue", "returned", false)).toEqual({
      ok: false,
      code: "OVERTIME_UNSETTLED",
      message: "Overtime must be settled before checkout."
    });
    expect(assertItemTransition("overdue", "returned", true).ok).toBe(true);
  });

  it("keeps booking active for partial checkout and completes when all returned", () => {
    expect(bookingStatusAfterCheckout(["returned", "stored"])).toBe("active");
    expect(bookingStatusAfterCheckout(["returned", "returned"])).toBe("completed");
  });
});

describe("refund specs/12 N1-N2 and cancellation", () => {
  it.each([
    ["N1", 140_000, 120_000],
    ["N2", 50_000, 30_000]
  ])("%s calculates no-show refund", (_caseId, total, expected) => {
    expect(noShowRefund(total)).toBe(expected);
  });

  it("calculates user cancellation refund", () => {
    expect(userCancellationRefund(50_000)).toBe(30_000);
  });
});
