CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE SEQUENCE "public"."booking_no_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"booking_id" uuid,
	"item_id" uuid,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"size" text NOT NULL,
	"unit_price_vnd" bigint NOT NULL,
	"capacity_points" integer NOT NULL,
	"status" text DEFAULT 'awaiting_dropoff' NOT NULL,
	"tag_no" text,
	"photo_url" text,
	"stored_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"overtime_fee_vnd" bigint DEFAULT 0 NOT NULL,
	"daily_storage_fee_vnd" bigint DEFAULT 0 NOT NULL,
	"overtime_settled" boolean DEFAULT false NOT NULL,
	"size_adjustment_vnd" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "booking_items_size_chk" CHECK ("booking_items"."size" in ('S','M','L')),
	CONSTRAINT "booking_items_status_chk" CHECK ("booking_items"."status" in ('awaiting_dropoff','stored','overdue','returned','abandoned'))
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_no" text NOT NULL,
	"store_id" uuid NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"visit_date" date NOT NULL,
	"arrival_slot_start" timestamp with time zone NOT NULL,
	"plan_hours" integer NOT NULL,
	"total_amount_vnd" bigint NOT NULL,
	"payment_provider" text NOT NULL,
	"payment_ref" text,
	"dropoff_otp_hash" text NOT NULL,
	"booking_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"otp_fail_count" integer DEFAULT 0 NOT NULL,
	"otp_locked_until" timestamp with time zone,
	"disclaimer_accepted_at" timestamp with time zone NOT NULL,
	"channel" text DEFAULT 'direct' NOT NULL,
	"referral_code" text,
	"external_ref" text,
	"insurance_addon_vnd" bigint DEFAULT 0 NOT NULL,
	"storage_started_at" timestamp with time zone,
	"return_due_at" timestamp with time zone,
	"cancelled_reason" text,
	"refund_amount_vnd" bigint,
	"refund_status" text DEFAULT 'none' NOT NULL,
	"daily_storage_fee_vnd" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_no_unique" UNIQUE("booking_no"),
	CONSTRAINT "bookings_booking_token_unique" UNIQUE("booking_token"),
	CONSTRAINT "bookings_status_chk" CHECK ("bookings"."status" in ('pending_payment','payment_failed','paid','active','completed','cancelled')),
	CONSTRAINT "bookings_plan_chk" CHECK ("bookings"."plan_hours" in (3,6,12)),
	CONSTRAINT "bookings_channel_chk" CHECK ("bookings"."channel" in (
        'direct','google','maps','ota_trip','ota_klook','ota_kkday',
        'hotel','bus_tour','store_poster','sns'
      )),
	CONSTRAINT "bookings_refund_chk" CHECK ("bookings"."refund_status" in ('none','pending','done'))
);
--> statement-breakpoint
CREATE TABLE "capacity_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"occupy_start" timestamp with time zone NOT NULL,
	"occupy_end" timestamp with time zone NOT NULL,
	"released" boolean DEFAULT false NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fee_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value_vnd" bigint,
	"effective_from" date DEFAULT current_date NOT NULL,
	"note" text,
	CONSTRAINT "fee_settings_key_chk" CHECK ("fee_settings"."key" in (
        'overtime_grace_minutes','overtime_hourly_vnd','overtime_cap_hours',
        'daily_storage_fee_vnd','cancellation_fee_vnd','noshow_fee_vnd',
        'relocate_after_days','insurance_limit_item_vnd','insurance_limit_booking_vnd'
      ))
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"booking_no" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiries_status_chk" CHECK ("inquiries"."status" in ('open','closed'))
);
--> statement-breakpoint
CREATE TABLE "insurance_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" jsonb NOT NULL,
	"price_vnd" bigint NOT NULL,
	"coverage_limit_vnd" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ota_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"code" text NOT NULL,
	"size" text NOT NULL,
	"plan_hours" integer NOT NULL,
	"redeemed_booking_id" uuid,
	"redeemed_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ota_vouchers_code_unique" UNIQUE("code"),
	CONSTRAINT "ota_vouchers_provider_chk" CHECK ("ota_vouchers"."provider" in ('trip','klook','kkday')),
	CONSTRAINT "ota_vouchers_size_chk" CHECK ("ota_vouchers"."size" in ('S','M','L')),
	CONSTRAINT "ota_vouchers_plan_chk" CHECK ("ota_vouchers"."plan_hours" in (3,6,12))
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_code_unique" UNIQUE("code"),
	CONSTRAINT "partners_type_chk" CHECK ("partners"."type" in ('hotel','bus_tour','attraction','other'))
);
--> statement-breakpoint
CREATE TABLE "pickup_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"otp_hash" text NOT NULL,
	"otp_plain" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"size" text NOT NULL,
	"plan_hours" integer NOT NULL,
	"price_vnd" bigint NOT NULL,
	"capacity_points" integer NOT NULL,
	"valid_from" date DEFAULT current_date NOT NULL,
	CONSTRAINT "price_plans_size_chk" CHECK ("price_plans"."size" in ('S','M','L')),
	CONSTRAINT "price_plans_plan_chk" CHECK ("price_plans"."plan_hours" in (3,6,12))
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"staff_code" text NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"area" text NOT NULL,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"capacity_points" integer NOT NULL,
	"open_time" time DEFAULT '00:00' NOT NULL,
	"close_time" time DEFAULT '24:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ota_vouchers" ADD CONSTRAINT "ota_vouchers_redeemed_booking_id_bookings_id_fk" FOREIGN KEY ("redeemed_booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_otps" ADD CONSTRAINT "pickup_otps_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_booking_idx" ON "audit_logs" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_items_booking_idx" ON "booking_items" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_store_date_status_idx" ON "bookings" USING btree ("store_id","visit_date","status");--> statement-breakpoint
CREATE INDEX "capacity_holds_overlap_idx" ON "capacity_holds" USING btree ("store_id","occupy_start","occupy_end");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_settings_uniq" ON "fee_settings" USING btree ("key","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "price_plans_uniq" ON "price_plans" USING btree ("size","plan_hours","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_store_code_uniq" ON "staff" USING btree ("store_id","staff_code");
--> statement-breakpoint
ALTER TABLE "bookings"
  ALTER COLUMN "booking_no" SET DEFAULT ('KC-' || lpad(nextval('booking_no_seq')::text, 6, '0'));
--> statement-breakpoint
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_holds_active_overlap"
  ON "capacity_holds" ("store_id", "occupy_start", "occupy_end") WHERE "released" = false;
