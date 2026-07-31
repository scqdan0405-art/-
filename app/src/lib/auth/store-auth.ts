import "server-only";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { staff } from "@/db/schema";
import { createServiceClient } from "@/lib/db";
import { ACCESS_TOKEN_COOKIE, STAFF_CODE_COOKIE, STAFF_GATE_SECONDS } from "@/lib/auth/constants";

export { ACCESS_TOKEN_COOKIE, STAFF_CODE_COOKIE, STAFF_GATE_SECONDS };

export type StoreAuthContext = {
  userId: string;
  storeId: string;
  accessToken: string;
};

export type StoreStaffContext = StoreAuthContext & {
  staffId: string;
  staffCode: string;
};

function bearerToken() {
  const authorization = headers().get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return cookies().get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function requireStoreAuth(): Promise<StoreAuthContext> {
  const accessToken = bearerToken();
  if (!accessToken) {
    notFound();
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    notFound();
  }

  const metadata = data.user.app_metadata as { role?: string; store_id?: string; must_change_password?: boolean };
  if (metadata.role !== "store" || !metadata.store_id || metadata.must_change_password === true) {
    notFound();
  }

  return {
    userId: data.user.id,
    storeId: metadata.store_id,
    accessToken
  };
}

export function readStaffCodeHeaderOrCookie() {
  return headers().get("x-staff-code") ?? cookies().get(STAFF_CODE_COOKIE)?.value ?? null;
}

export async function requireStoreStaff(): Promise<StoreStaffContext> {
  const context = await requireStoreAuth();
  const staffCode = readStaffCodeHeaderOrCookie();

  if (!staffCode) {
    throw new Response(JSON.stringify({ code: "STAFF_CODE_REQUIRED" }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });
  }

  const [row] = await db
    .select({ id: staff.id, isActive: staff.isActive })
    .from(staff)
    .where(and(eq(staff.storeId, context.storeId), eq(staff.staffCode, staffCode)))
    .limit(1);

  const valid = row && row.isActive;
  if (!valid) {
    throw new Response(JSON.stringify({ code: "STAFF_CODE_INVALID" }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });
  }

  return {
    ...context,
    staffId: row.id,
    staffCode
  };
}
