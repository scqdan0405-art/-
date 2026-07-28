import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for server-side Drizzle access.");
}

const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
