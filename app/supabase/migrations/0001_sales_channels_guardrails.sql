CREATE TABLE IF NOT EXISTS "sales_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "channel_type" text NOT NULL,
  "commission_rate" double precision DEFAULT 0 NOT NULL,
  "supports_voucher" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sales_channels_code_unique" UNIQUE("code"),
  CONSTRAINT "sales_channels_type_chk" CHECK ("sales_channels"."channel_type" in ('direct','organic','ota','referral','store','sns'))
);
--> statement-breakpoint

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "channel_code" text;
--> statement-breakpoint

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_channel_chk";
--> statement-breakpoint

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_channel_chk"
  CHECK ("bookings"."channel" in ('direct','organic','ota','referral','store','sns'));
--> statement-breakpoint

ALTER TABLE "price_plans" ADD COLUMN IF NOT EXISTS "channel_tier" text DEFAULT 'direct' NOT NULL;
--> statement-breakpoint

ALTER TABLE "price_plans" DROP CONSTRAINT IF EXISTS "price_plans_channel_tier_chk";
--> statement-breakpoint

ALTER TABLE "price_plans" ADD CONSTRAINT "price_plans_channel_tier_chk"
  CHECK ("price_plans"."channel_tier" in ('direct','ota'));
--> statement-breakpoint

DROP INDEX IF EXISTS "price_plans_uniq";
--> statement-breakpoint

CREATE UNIQUE INDEX "price_plans_uniq" ON "price_plans" USING btree ("size","plan_hours","channel_tier","valid_from");
--> statement-breakpoint

ALTER TABLE "ota_vouchers" DROP CONSTRAINT IF EXISTS "ota_vouchers_provider_chk";
