import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DEFAULT_LOCALE: z.enum(["en", "vi", "ja"]).default("ja"),
  PAYMENT_PROVIDER: z.enum(["mock", "2c2p"]).default("mock"),
  TWOC2P_MERCHANT_ID: z.string().optional(),
  TWOC2P_SECRET_KEY: z.string().optional(),
  TWOC2P_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  MAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  APP_BASE_URL: process.env.APP_BASE_URL,
  DEFAULT_LOCALE: process.env.DEFAULT_LOCALE,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
  TWOC2P_MERCHANT_ID: process.env.TWOC2P_MERCHANT_ID,
  TWOC2P_SECRET_KEY: process.env.TWOC2P_SECRET_KEY,
  TWOC2P_ENV: process.env.TWOC2P_ENV,
  MAIL_PROVIDER: process.env.MAIL_PROVIDER,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: process.env.NODE_ENV
});
