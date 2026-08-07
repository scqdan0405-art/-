import { beforeEach, describe, expect, it } from "vitest";
import { clearIdempotencyMemory, getIdempotentResponse, rememberIdempotentResponse } from "./idempotency";

describe("idempotency specs/12 I1-I2", () => {
  beforeEach(() => clearIdempotencyMemory());

  it("I1 returns the same response for the same key", () => {
    const first = rememberIdempotentResponse("same-key", { bookingNo: "KC-000001" });

    expect(getIdempotentResponse("same-key")).toBe(first);
  });

  it("I2 keeps different keys separate", () => {
    rememberIdempotentResponse("key-1", { bookingNo: "KC-000001" });
    rememberIdempotentResponse("key-2", { bookingNo: "KC-000002" });

    expect(getIdempotentResponse<{ bookingNo: string }>("key-1")?.bookingNo).toBe("KC-000001");
    expect(getIdempotentResponse<{ bookingNo: string }>("key-2")?.bookingNo).toBe("KC-000002");
  });
});
