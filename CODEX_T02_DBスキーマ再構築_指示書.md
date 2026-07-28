# Codex 指示書 — T02 再構築（DBスキーマ / Drizzle）

作成: 2026-07-28 ／ 前提: `docs/KONCOCHII_開発整合性監査.html`（重大A1/A2）と `spec/specs/01-data-model.md`・`06-security.md`・`11-tech-stack.md`

## 0. なぜ作り直すか（背景）

初期スケルトンの `app/supabase/migrations/` が仕様と乖離している。**仕様（specs/）が正**。次を必ず直す。

- テーブル不足：現状 `stores / bookings / payments / otp_challenges / audit_logs` の5表のみ。specs/01は**13表**。
- **OTPの誤設計（最重要）**：現状 `otp_challenges` 1本に drop-off/pickup を `purpose` 列で混在。specs/06 は「drop-off OTP の受取流用**不可＝別テーブル検証**」を要求。
  → 預入OTPは **`bookings.dropoff_otp_hash`**（ハッシュ列）、受取OTPは独立した **`pickup_otps`**（`otp_hash` ＋ **`otp_plain`**＝有効期間限定・OTP不達対策）に分離する。
- 仕様に無い `payments` 独自テーブルは廃止（決済参照は `bookings.payment_provider / payment_ref`）。
- `audit_logs.id` は **bigint identity**（現状 uuid は不可）。列は `actor_type / actor_id / action / booking_id / item_id / detail`。
- **Drizzle未導入**：specs/11 は Drizzle ORM 確定。生 supabase-js から移行し、`app/src/db/schema.ts` を正とする。

## 1. ゴール

TASKS.md の **T02 を仕様どおりに作り直す**。完了条件：

1. `app/src/db/schema.ts` が下記スキーマ（13表＋sequence）で、specs/01 と一致。
2. `drizzle-kit` でマイグレーション生成 → `supabase/migrations/` に反映（**既存の誤ったSQLは置き換え**）。
3. `supabase/seed.sql` が specs/01 の seed（店舗3・スタッフ各2・price_plans 9行・fee_settings 初期値・admin1・**店舗アカウント3**）を満たす。
4. 全テーブルで **RLS 有効化＋anonロール全拒否**（サーバーの service role 経由のみ）。
5. `otp_challenges` / `payments` を削除し、参照コード（`lib/`）を新スキーマに追従。
6. `npm run build && npm run test` が通る。秘密はコミットしない（`.env.example` のみ）。

## 2. 依存パッケージ

```
npm i drizzle-orm postgres
npm i -D drizzle-kit
```

`app/drizzle.config.ts`：

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

`app/src/db/client.ts`（サーバー専用・service role 相当の接続文字列を使用）：

```ts
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
```

## 3. `app/src/db/schema.ts`（このまま作成。specs/01 と1対1）

```ts
import {
  pgTable, pgSequence, uuid, text, jsonb, integer, bigint, boolean,
  timestamp, date, time, doublePrecision, uniqueIndex, index, check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 予約番号シーケンス（'KC-' + 6桁ゼロ埋め）
export const bookingNoSeq = pgSequence("booking_no_seq");

// 店舗
export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),                 // 'BT','BV','AP'
  name: jsonb("name").notNull(),                         // {en,vi,ja}
  area: text("area").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  capacityPoints: integer("capacity_points").notNull(),
  openTime: time("open_time").notNull().default("00:00"),
  closeTime: time("close_time").notNull().default("24:00"), // 24h店は00:00-24:00
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 店舗スタッフ（個人コード）※認証ではなく行為者識別（specs/16）
export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").notNull().references(() => stores.id),
  staffCode: text("staff_code").notNull(),               // 店舗内一意4桁
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  uniq: uniqueIndex("staff_store_code_uniq").on(t.storeId, t.staffCode),
}));

// 料金マスタ
export const pricePlans = pgTable("price_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  size: text("size").notNull(),
  planHours: integer("plan_hours").notNull(),
  priceVnd: bigint("price_vnd", { mode: "number" }).notNull(),
  capacityPoints: integer("capacity_points").notNull(),  // S=1,M=2,L=3
  validFrom: date("valid_from").notNull().defaultNow(),
}, (t) => ({
  sizeChk: check("price_plans_size_chk", sql`${t.size} in ('S','M','L')`),
  planChk: check("price_plans_plan_chk", sql`${t.planHours} in (3,6,12)`),
  uniq: uniqueIndex("price_plans_uniq").on(t.size, t.planHours, t.validFrom),
}));

// スカラー料金設定（超過単価・打ち止め・日額・各種手数料）
export const feeSettings = pgTable("fee_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  valueVnd: bigint("value_vnd", { mode: "number" }),      // 未定はnull（例 daily_storage_fee_vnd）
  effectiveFrom: date("effective_from").notNull().defaultNow(),
  note: text("note"),
}, (t) => ({
  keyChk: check("fee_settings_key_chk", sql`${t.key} in (
    'overtime_grace_minutes','overtime_hourly_vnd','overtime_cap_hours',
    'daily_storage_fee_vnd','cancellation_fee_vnd','noshow_fee_vnd',
    'relocate_after_days','insurance_limit_item_vnd','insurance_limit_booking_vnd'
  )`),
  uniq: uniqueIndex("fee_settings_uniq").on(t.key, t.effectiveFrom),
}));

// 予約
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingNo: text("booking_no").notNull().unique(),      // 'KC-000001'
  storeId: uuid("store_id").notNull().references(() => stores.id),
  status: text("status").notNull().default("pending_payment"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),                        // E.164
  locale: text("locale").notNull().default("en"),
  visitDate: date("visit_date").notNull(),
  arrivalSlotStart: timestamp("arrival_slot_start", { withTimezone: true }).notNull(),
  planHours: integer("plan_hours").notNull(),
  totalAmountVnd: bigint("total_amount_vnd", { mode: "number" }).notNull(),
  paymentProvider: text("payment_provider").notNull(),   // 'mock' | '2c2p'
  paymentRef: text("payment_ref"),
  dropoffOtpHash: text("dropoff_otp_hash").notNull(),    // bcrypt。平文保存しない
  bookingToken: uuid("booking_token").notNull().unique().defaultRandom(),
  otpFailCount: integer("otp_fail_count").notNull().default(0),
  otpLockedUntil: timestamp("otp_locked_until", { withTimezone: true }),
  disclaimerAcceptedAt: timestamp("disclaimer_accepted_at", { withTimezone: true }).notNull(),
  channel: text("channel").notNull().default("direct"),
  referralCode: text("referral_code"),
  externalRef: text("external_ref"),
  insuranceAddonVnd: bigint("insurance_addon_vnd", { mode: "number" }).notNull().default(0),
  storageStartedAt: timestamp("storage_started_at", { withTimezone: true }),
  returnDueAt: timestamp("return_due_at", { withTimezone: true }),
  cancelledReason: text("cancelled_reason"),             // no_show|user_request|prohibited_item
  refundAmountVnd: bigint("refund_amount_vnd", { mode: "number" }),
  refundStatus: text("refund_status").notNull().default("none"),
  dailyStorageFeeVnd: bigint("daily_storage_fee_vnd", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusChk: check("bookings_status_chk", sql`${t.status} in
    ('pending_payment','payment_failed','paid','active','completed','cancelled')`),
  planChk: check("bookings_plan_chk", sql`${t.planHours} in (3,6,12)`),
  channelChk: check("bookings_channel_chk", sql`${t.channel} in
    ('direct','google','maps','ota_trip','ota_klook','ota_kkday','hotel','bus_tour','store_poster','sns')`),
  refundChk: check("bookings_refund_chk", sql`${t.refundStatus} in ('none','pending','done')`),
  idx: index("bookings_store_date_status_idx").on(t.storeId, t.visitDate, t.status),
}));

// 荷物（荷物単位ステータス）
export const bookingItems = pgTable("booking_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  size: text("size").notNull(),
  unitPriceVnd: bigint("unit_price_vnd", { mode: "number" }).notNull(),  // スナップショット
  capacityPoints: integer("capacity_points").notNull(),
  status: text("status").notNull().default("awaiting_dropoff"),
  tagNo: text("tag_no"),
  photoUrl: text("photo_url"),
  storedAt: timestamp("stored_at", { withTimezone: true }),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  overtimeFeeVnd: bigint("overtime_fee_vnd", { mode: "number" }).notNull().default(0),
  dailyStorageFeeVnd: bigint("daily_storage_fee_vnd", { mode: "number" }).notNull().default(0),
  overtimeSettled: boolean("overtime_settled").notNull().default(false),
  sizeAdjustmentVnd: bigint("size_adjustment_vnd", { mode: "number" }).notNull().default(0),
}, (t) => ({
  sizeChk: check("booking_items_size_chk", sql`${t.size} in ('S','M','L')`),
  statusChk: check("booking_items_status_chk", sql`${t.status} in
    ('awaiting_dropoff','stored','overdue','returned','abandoned')`),
  idx: index("booking_items_booking_idx").on(t.bookingId),
}));

// 返却用OTP（都度発行・短命・別テーブル＝specs/06）
export const pickupOtps = pgTable("pickup_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  otpHash: text("otp_hash").notNull(),
  otpPlain: text("otp_plain"),                            // 予約ページ表示用（06の例外）。使用/失効時にnull化
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // 発行+10分
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 容量確保（時間帯の重なりで判定＝specs/12.4・01）
export const capacityHolds = pgTable("capacity_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").notNull().references(() => stores.id),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  points: integer("points").notNull(),
  occupyStart: timestamp("occupy_start", { withTimezone: true }).notNull(),
  occupyEnd: timestamp("occupy_end", { withTimezone: true }).notNull(),
  released: boolean("released").notNull().default(false),
  releasedAt: timestamp("released_at", { withTimezone: true }),
}, (t) => ({
  // 重なり判定用（released=false のみ対象の部分インデックス）
  idx: index("capacity_holds_overlap_idx").on(t.storeId, t.occupyStart, t.occupyEnd),
}));

// 紹介パートナー
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  typeChk: check("partners_type_chk", sql`${t.type} in ('hotel','bus_tour','attraction','other')`),
}));

// 追加補償オプションマスタ（PoCはUI非表示・スキーマ先行）
export const insuranceAddons = pgTable("insurance_addons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: jsonb("name").notNull(),
  priceVnd: bigint("price_vnd", { mode: "number" }).notNull(),
  coverageLimitVnd: bigint("coverage_limit_vnd", { mode: "number" }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// 問い合わせ
export const inquiries = pgTable("inquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  bookingNo: text("booking_no"),
  body: text("body").notNull(),
  status: text("status").notNull().default("open"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusChk: check("inquiries_status_chk", sql`${t.status} in ('open','closed')`),
}));

// OTAバウチャー（レベル2用・テーブルのみ）
export const otaVouchers = pgTable("ota_vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  code: text("code").notNull().unique(),
  size: text("size").notNull(),
  planHours: integer("plan_hours").notNull(),
  redeemedBookingId: uuid("redeemed_booking_id").references(() => bookings.id),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  provChk: check("ota_vouchers_provider_chk", sql`${t.provider} in ('trip','klook','kkday')`),
  sizeChk: check("ota_vouchers_size_chk", sql`${t.size} in ('S','M','L')`),
  planChk: check("ota_vouchers_plan_chk", sql`${t.planHours} in (3,6,12)`),
}));

// 監査ログ（bigint identity）
export const auditLogs = pgTable("audit_logs", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorType: text("actor_type").notNull(),               // guest|staff|admin|system
  actorId: text("actor_id"),                             // staff.id / admin uid / booking_token
  action: text("action").notNull(),
  bookingId: uuid("booking_id"),
  itemId: uuid("item_id"),
  detail: jsonb("detail"),
}, (t) => ({
  idx: index("audit_logs_booking_idx").on(t.bookingId),
}));
```

## 4. マイグレーション後に手SQLで足すもの（drizzle生成SQLの末尾 or 追加マイグレーションに追記）

Drizzle が表現しづらい項目は生SQLで補う。

```sql
-- booking_no のデフォルトをシーケンス由来に（'KC-000001'）
alter table bookings
  alter column booking_no set default ('KC-' || lpad(nextval('booking_no_seq')::text, 6, '0'));

-- RLS 全テーブル有効化＋anon全拒否（service role 経由のみ。defense in depth＝specs/06）
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;
-- ポリシーは作らない＝anon/authenticated は既定で全拒否。サーバーは service role（RLSバイパス）で接続。

-- capacity_holds の重なり判定を効かせる部分インデックス
create index if not exists capacity_holds_active_overlap
  on capacity_holds (store_id, occupy_start, occupy_end) where released = false;
```

## 5. seed（`supabase/seed.sql`、specs/01 §seed）

- 店舗3件：BT/BV=capacity 20pt、AP=30pt。**全店 24時間営業**（open 00:00 / close 24:00）。
- 各店舗スタッフ2名（staff_code は4桁・store内一意）。
- price_plans 9行（確定値）：S=50,000/70,000/100,000・M=70,000/100,000/150,000・L=100,000/150,000/200,000（3/6/12h）。points S=1,M=2,L=3。
- fee_settings 初期値：overtime_grace_minutes=15 / overtime_hourly_vnd=10,000 / overtime_cap_hours=24 / cancellation_fee_vnd=20,000 / noshow_fee_vnd=20,000 / relocate_after_days=7 / insurance_limit_item_vnd=5,000,000 / insurance_limit_booking_vnd=10,000,000 / **daily_storage_fee_vnd=null**（未確定）。
- 管理者ユーザー1（Supabase Auth, `app_metadata.role='admin'`）。
- **店舗アカウント3（Supabase Auth, `app_metadata:{role:'store', store_id:<各店>}`）**＝specs/16。email/初期パスワードは `.env.example` に記載（実値はコミットしない）。※Auth ユーザーは SQL seed では作れないため、`scripts/seed-auth.ts`（service role で Admin API 呼び出し）を用意して手順化してよい。

## 6. 既存コードの追従（重要）

- `otp_challenges` / `payments` を参照する既存コード・型を削除し、`bookings.dropoffOtpHash` ＋ `pickupOtps` に置換。
- `lib/db.ts`（生 supabase-js）は Storage/Auth 管理用途に限定し、**業務データアクセスは `src/db/client.ts`（Drizzle）に一本化**。
- 決済は `bookings.paymentProvider/paymentRef` を使用（`payments` 表は作らない）。

## 7. 受け入れ基準（T02完了チェック）

- [ ] `schema.ts` に13表＋`booking_no_seq` が存在し、specs/01 と列・型・制約が一致（bigint audit / 別 pickup_otps / otp_plain）。
- [ ] `otp_challenges` と `payments` が存在しない。
- [ ] `drizzle-kit generate` で `supabase/migrations/` が再生成され、`npx supabase db reset` が成功（seed込み）。
- [ ] 全テーブルで RLS 有効。anon 接続では全テーブル読めない（service role のみ可）。
- [ ] price_plans 9行・fee_settings 9キー（daily=null）・店舗3・スタッフ6・店舗アカウント3・admin1 が seed される。
- [ ] `npm run build && npm run test` が通る。`.env.example` 更新済み・実値は未コミット。

## 8. Codex に貼るプロンプト（この章をそのまま貼る）

```
spec/specs/01-data-model.md・06-security.md・11-tech-stack.md と
CODEX_T02_DBスキーマ再構築_指示書.md を確定仕様として読み、T02 を作り直してください。

重要:
- 仕様が正。既存の otp_challenges（drop-off/pickup混在）と payments 表は廃止する。
- 預入OTP=bookings.dropoff_otp_hash、受取OTP=独立 pickup_otps(otp_hash + otp_plain)。別テーブルで検証（specs/06）。
- Drizzle ORM を導入し app/src/db/schema.ts を指示書 §3 のとおり作成（13表＋booking_no_seq）。
- drizzle-kit でマイグレーション生成→supabase/migrations/ を置き換え、§4のRLS/デフォルト/インデックスの生SQLを足す。
- seed は §5（店舗3・スタッフ6・price_plans9・fee_settings9(daily=null)・admin1・店舗アカウント3）。
- 既存 lib/ の otp_challenges/payments 参照を新スキーマに追従。npm run build && npm run test を通す。
- 秘密はコミットしない（.env.example のみ更新）。完了したら受け入れ基準（§7）の結果を報告。
```
