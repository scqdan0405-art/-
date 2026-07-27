import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertRateLimit, clearRateLimitBuckets } from "@/lib/rate-limit";

describe("assertRateLimit", () => {
  beforeEach(() => clearRateLimitBuckets());

  it("allows requests within the configured limit", () => {
    expect(() => assertRateLimit({ key: "ip:1", limit: 2, windowMs: 1000 })).not.toThrow();
    expect(() => assertRateLimit({ key: "ip:1", limit: 2, windowMs: 1000 })).not.toThrow();
  });

  it("throws after the limit is exceeded", () => {
    assertRateLimit({ key: "ip:2", limit: 1, windowMs: 1000 });

    expect(() => assertRateLimit({ key: "ip:2", limit: 1, windowMs: 1000 })).toThrow(AppError);
  });
});
