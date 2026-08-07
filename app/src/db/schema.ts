import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const bookingNoSeq = pgSequence("booking_no_seq");

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: jsonb("name").notNull(),
  area: text("area").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  capacityPoints: integer("capacity_points").notNull(),
  openTime: time("open_time").notNull().default("00:00"),
  closeTime: time("close_time").notNull().default("24:00"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    staffCode: text("staff_code").notNull(),
    displayName: text("display_name").notNull(),
    isActive: boolean("is_active").notNull().default(true)
  },
  (t) => ({
    uniq: uniqueIndex("staff_store_code_uniq").on(t.storeId, t.staffCode)
  })
);

export const pricePlans = pgTable(
  "price_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    size: text("size").notNull(),
    planHours: integer("plan_hours").notNull(),
    channelTier: text("channel_tier").notNull().default("direct"),
    priceVnd: bigint("price_vnd", { mode: "number" }).notNull(),
    capacityPoints: integer("capacity_points").notNull(),
    validFrom: date("valid_from").notNull().default(sql`current_date`)
  },
  (t) => ({
    sizeChk: check("price_plans_size_chk", sql`${t.size} in ('S','M','L')`),
    planChk: check("price_plans_plan_chk", sql`${t.planHours} in (3,6,12)`),
    tierChk: check("price_plans_channel_tier_chk", sql`${t.channelTier} in ('direct','ota')`),
    uniq: uniqueIndex("price_plans_uniq").on(t.size, t.planHours, t.channelTier, t.validFrom)
  })
);

export const feeSettings = pgTable(
  "fee_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    valueVnd: bigint("value_vnd", { mode: "number" }),
    effectiveFrom: date("effective_from").notNull().default(sql`current_date`),
    note: text("note")
  },
  (t) => ({
    keyChk: check(
      "fee_settings_key_chk",
      sql`${t.key} in (
        'overtime_grace_minutes','overtime_hourly_vnd','overtime_cap_hours',
        'daily_storage_fee_vnd','cancellation_fee_vnd','noshow_fee_vnd',
        'relocate_after_days','insurance_limit_item_vnd','insurance_limit_booking_vnd'
      )`
    ),
    uniq: uniqueIndex("fee_settings_uniq").on(t.key, t.effectiveFrom)
  })
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingNo: text("booking_no").notNull().unique(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    status: text("status").notNull().default("pending_payment"),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    locale: text("locale").notNull().default("en"),
    visitDate: date("visit_date").notNull(),
    arrivalSlotStart: timestamp("arrival_slot_start", { withTimezone: true }).notNull(),
    planHours: integer("plan_hours").notNull(),
    totalAmountVnd: bigint("total_amount_vnd", { mode: "number" }).notNull(),
    paymentProvider: text("payment_provider").notNull(),
    paymentRef: text("payment_ref"),
    dropoffOtpHash: text("dropoff_otp_hash").notNull(),
    bookingToken: uuid("booking_token").notNull().unique().defaultRandom(),
    otpFailCount: integer("otp_fail_count").notNull().default(0),
    otpLockedUntil: timestamp("otp_locked_until", { withTimezone: true }),
    disclaimerAcceptedAt: timestamp("disclaimer_accepted_at", { withTimezone: true }).notNull(),
    channel: text("channel").notNull().default("direct"),
    channelCode: text("channel_code"),
    referralCode: text("referral_code"),
    externalRef: text("external_ref"),
    insuranceAddonVnd: bigint("insurance_addon_vnd", { mode: "number" }).notNull().default(0),
    storageStartedAt: timestamp("storage_started_at", { withTimezone: true }),
    returnDueAt: timestamp("return_due_at", { withTimezone: true }),
    cancelledReason: text("cancelled_reason"),
    refundAmountVnd: bigint("refund_amount_vnd", { mode: "number" }),
    refundStatus: text("refund_status").notNull().default("none"),
    dailyStorageFeeVnd: bigint("daily_storage_fee_vnd", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    statusChk: check(
      "bookings_status_chk",
      sql`${t.status} in ('pending_payment','payment_failed','paid','active','completed','cancelled')`
    ),
    planChk: check("bookings_plan_chk", sql`${t.planHours} in (3,6,12)`),
    channelChk: check(
      "bookings_channel_chk",
      sql`${t.channel} in ('direct','organic','ota','referral','store','sns')`
    ),
    refundChk: check("bookings_refund_chk", sql`${t.refundStatus} in ('none','pending','done')`),
    idx: index("bookings_store_date_status_idx").on(t.storeId, t.visitDate, t.status)
  })
);

export const salesChannels = pgTable(
  "sales_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    channelType: text("channel_type").notNull(),
    commissionRate: doublePrecision("commission_rate").notNull().default(0),
    supportsVoucher: boolean("supports_voucher").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    typeChk: check("sales_channels_type_chk", sql`${t.channelType} in ('direct','organic','ota','referral','store','sns')`)
  })
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    size: text("size").notNull(),
    unitPriceVnd: bigint("unit_price_vnd", { mode: "number" }).notNull(),
    capacityPoints: integer("capacity_points").notNull(),
    status: text("status").notNull().default("awaiting_dropoff"),
    tagNo: text("tag_no"),
    photoUrl: text("photo_url"),
    storedAt: timestamp("stored_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    overtimeFeeVnd: bigint("overtime_fee_vnd", { mode: "number" }).notNull().default(0),
    dailyStorageFeeVnd: bigint("daily_storage_fee_vnd", { mode: "number" }).notNull().default(0),
    overtimeSettled: boolean("overtime_settled").notNull().default(false),
    sizeAdjustmentVnd: bigint("size_adjustment_vnd", { mode: "number" }).notNull().default(0)
  },
  (t) => ({
    sizeChk: check("booking_items_size_chk", sql`${t.size} in ('S','M','L')`),
    statusChk: check(
      "booking_items_status_chk",
      sql`${t.status} in ('awaiting_dropoff','stored','overdue','returned','abandoned')`
    ),
    idx: index("booking_items_booking_idx").on(t.bookingId)
  })
);

export const pickupOtps = pgTable("pickup_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),
  otpHash: text("otp_hash").notNull(),
  otpPlain: text("otp_plain"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const capacityHolds = pgTable(
  "capacity_holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    points: integer("points").notNull(),
    occupyStart: timestamp("occupy_start", { withTimezone: true }).notNull(),
    occupyEnd: timestamp("occupy_end", { withTimezone: true }).notNull(),
    released: boolean("released").notNull().default(false),
    releasedAt: timestamp("released_at", { withTimezone: true })
  },
  (t) => ({
    idx: index("capacity_holds_overlap_idx").on(t.storeId, t.occupyStart, t.occupyEnd)
  })
);

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    typeChk: check("partners_type_chk", sql`${t.type} in ('hotel','bus_tour','attraction','other')`)
  })
);

export const insuranceAddons = pgTable("insurance_addons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: jsonb("name").notNull(),
  priceVnd: bigint("price_vnd", { mode: "number" }).notNull(),
  coverageLimitVnd: bigint("coverage_limit_vnd", { mode: "number" }).notNull(),
  isActive: boolean("is_active").notNull().default(true)
});

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    bookingNo: text("booking_no"),
    body: text("body").notNull(),
    status: text("status").notNull().default("open"),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    statusChk: check("inquiries_status_chk", sql`${t.status} in ('open','closed')`)
  })
);

export const otaVouchers = pgTable(
  "ota_vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    code: text("code").notNull().unique(),
    size: text("size").notNull(),
    planHours: integer("plan_hours").notNull(),
    redeemedBookingId: uuid("redeemed_booking_id").references(() => bookings.id),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    sizeChk: check("ota_vouchers_size_chk", sql`${t.size} in ('S','M','L')`),
    planChk: check("ota_vouchers_plan_chk", sql`${t.planHours} in (3,6,12)`)
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    bookingId: uuid("booking_id"),
    itemId: uuid("item_id"),
    detail: jsonb("detail")
  },
  (t) => ({
    idx: index("audit_logs_booking_idx").on(t.bookingId)
  })
);
