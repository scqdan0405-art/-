import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"];
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is required.`);
  }
}

const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

async function upsertUser(email, password, appMetadata) {
  if (!email || !password) {
    console.warn(`Skipping auth seed for ${email || "(missing email)"} because password is empty.`);
    return;
  }

  const { data: existing, error: listError } = await authClient.auth.admin.listUsers();
  if (listError) {
    throw listError;
  }

  const match = existing.users.find((user) => user.email === email);
  if (match) {
    const { error } = await authClient.auth.admin.updateUserById(match.id, {
      password,
      app_metadata: appMetadata,
      email_confirm: true
    });
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await authClient.auth.admin.createUser({
    email,
    password,
    app_metadata: appMetadata,
    email_confirm: true
  });
  if (error) {
    throw error;
  }
}

async function main() {
  await upsertUser(process.env.SEED_ADMIN_EMAIL ?? "admin@example.com", process.env.SEED_ADMIN_PASSWORD, {
    role: "admin"
  });

  const stores = await sql`select code, id from stores where code in ('BT', 'BV', 'AP')`;
  for (const store of stores) {
    await upsertUser(process.env[`SEED_STORE_${store.code}_EMAIL`], process.env[`SEED_STORE_${store.code}_PASSWORD`], {
      role: "store",
      store_id: store.id
    });
  }

  await sql.end();
}

main().catch(async (error) => {
  await sql.end({ timeout: 1 }).catch(() => {});
  console.error(error);
  process.exit(1);
});
