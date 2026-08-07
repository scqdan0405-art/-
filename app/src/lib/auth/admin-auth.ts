import "server-only";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/db";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";

export type AdminAuthContext = {
  userId: string;
  accessToken: string;
};

function bearerToken() {
  const authorization = headers().get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return cookies().get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function requireAdminAuth(): Promise<AdminAuthContext> {
  const accessToken = bearerToken();
  if (!accessToken) {
    notFound();
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    notFound();
  }

  const metadata = data.user.app_metadata as { role?: string };
  if (metadata.role !== "admin") {
    notFound();
  }

  return { userId: data.user.id, accessToken };
}
