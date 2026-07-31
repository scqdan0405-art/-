export type AppRole = "store" | "admin";

export type AppMetadata = {
  role?: string;
  store_id?: string;
  must_change_password?: boolean;
};

export type AuthClaims = {
  sub?: string;
  app_metadata?: AppMetadata;
  exp?: number;
};

export function decodeJwtPayload(token: string): AuthClaims | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as AuthClaims;
  } catch {
    return null;
  }
}

export function isExpired(claims: AuthClaims, nowSeconds = Math.floor(Date.now() / 1000)) {
  return typeof claims.exp === "number" && claims.exp <= nowSeconds;
}

export function hasRole(claims: AuthClaims | null, role: AppRole) {
  return claims?.app_metadata?.role === role && !isExpired(claims);
}

export function mustChangePassword(claims: AuthClaims | null) {
  return claims?.app_metadata?.must_change_password === true;
}

export function getStoreId(claims: AuthClaims | null) {
  return claims?.app_metadata?.store_id ?? null;
}
