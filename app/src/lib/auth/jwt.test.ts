import { describe, expect, it } from "vitest";
import { decodeJwtPayload, getStoreId, hasRole, mustChangePassword } from "./jwt";

function unsignedJwt(payload: object) {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature"
  ].join(".");
}

describe("JWT app_metadata helpers", () => {
  it("reads role and store_id only from app_metadata", () => {
    const claims = decodeJwtPayload(
      unsignedJwt({
        exp: Math.floor(Date.now() / 1000) + 60,
        user_metadata: { role: "admin", store_id: "evil-store" },
        app_metadata: { role: "store", store_id: "store-1" }
      })
    );

    expect(hasRole(claims, "store")).toBe(true);
    expect(hasRole(claims, "admin")).toBe(false);
    expect(getStoreId(claims)).toBe("store-1");
  });

  it("detects must_change_password from app_metadata", () => {
    const claims = decodeJwtPayload(unsignedJwt({ app_metadata: { role: "store", must_change_password: true } }));

    expect(mustChangePassword(claims)).toBe(true);
  });
});
