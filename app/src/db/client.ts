import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

function createDb() {
  if (!env.DATABASE_URL) {
    return new Proxy(
      {},
      {
        get() {
          throw new Error("DATABASE_URL is required for server-side Drizzle access.");
        }
      }
    ) as ReturnType<typeof drizzle<typeof schema>>;
  }

  const client = postgres(env.DATABASE_URL, { prepare: false });
  return drizzle(client, { schema });
}

export const db = createDb();
