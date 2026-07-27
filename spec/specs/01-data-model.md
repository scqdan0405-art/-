# 01. データモデル(Supabase / PostgreSQL)

マイグレーションは `supabase/migrations/` に置く。以下のDDLが正。

```sql
-- 店舗
create table stores (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- 'BT', 'BV', 'AP'
  name jsonb not null,                    -- {"en":"...","vi":"...","ja":"..."} ロケール別
  area text not null,
  address text not null,
  lat double precision, lng double precision,
  capacity_points int not null,           -- 容量ポイント上限
  open_time time not null default '00:00',
  close_time time not null default '24:00',   -- 24h店は 00:00-24:00
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 店舗スタッフ(個人コード)
create table staff (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  staff_code text not null,               -- 店舗内一意の個人コード(4桁)
  display_name text not null,
  is_active boolean not null default true,
  unique(store_id, staff_code)
);

-- 料金マスタ
create table price_plans (
  id uuid primary key default gen_random_uuid(),
  size text not null check (size in ('S','M','L')),
  plan_hours int not null check (plan_hours in (3,6,12)),
  price_vnd bigint not null,
  capacity_points int not null,           -- S=1,M=2,L=3
  valid_from date not null default current_date,
  unique(size, plan_hours, valid_from)
);

-- 予約
create table bookings (
  id uuid primary key default gen_random_uuid(),
  booking_no text unique not null,        -- 'KC-000001' シーケンスから生成
  store_id uuid not null references stores(id),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','payment_failed','paid','active','completed','cancelled')),
  email text not null,
  phone text not null,                    -- E.164。OTPリカバリ用に必須
  locale text not null default 'en',
  visit_date date not null,
  arrival_slot_start timestamptz not null, -- 到着時間帯(1時間枠)の開始
  plan_hours int not null check (plan_hours in (3,6,12)),
  total_amount_vnd bigint not null,
  payment_provider text not null,          -- 'mock' | 'stripe'
  payment_ref text,                        -- PSP側ID
  dropoff_otp_hash text not null,          -- bcryptハッシュ。平文は保存しない
  booking_token uuid unique not null default gen_random_uuid(), -- QRペイロード/マイページURL
  otp_fail_count int not null default 0,
  otp_locked_until timestamptz,
  disclaimer_accepted_at timestamptz not null,
  channel text not null default 'direct'
    check (channel in ('direct','google','maps','ota_trip','ota_klook','ota_kkday','hotel','bus_tour','store_poster','sns')),
  referral_code text,                      -- partners.code(紹介パートナー経由時)
  external_ref text,                       -- OTAバウチャーコード/OTA予約番号(レベル2用)
  insurance_addon_vnd bigint not null default 0,  -- 任意の追加補償オプション料金(0=基本補償のみ)
  storage_started_at timestamptz,
  return_due_at timestamptz,
  cancelled_reason text,                   -- 'no_show' | 'user_request'
  refund_amount_vnd bigint,
  created_at timestamptz not null default now()
);

-- 荷物(荷物単位ステータス)
create table booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  size text not null check (size in ('S','M','L')),
  unit_price_vnd bigint not null,          -- 予約時点スナップショット
  capacity_points int not null,
  status text not null default 'awaiting_dropoff'
    check (status in ('awaiting_dropoff','stored','overdue','returned','abandoned')),
  tag_no text,                             -- 預け入れ時に付与
  photo_url text,                          -- 預け入れ時写真(必須)。Supabase Storage
  stored_at timestamptz,
  returned_at timestamptz,
  overtime_fee_vnd bigint not null default 0,
  overtime_settled boolean not null default false
);

-- 返却用OTP(都度発行・短命)
create table pickup_otps (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  otp_hash text not null,
  expires_at timestamptz not null,         -- 発行+10分
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- 容量確保(予約時に押さえる)
create table capacity_holds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  booking_id uuid not null references bookings(id),
  points int not null,
  hold_date date not null,
  released boolean not null default false
);

-- 紹介パートナー(ホテル・バス・ツアー会社等)
create table partners (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- ?ref= に使う紹介コード
  name text not null,
  type text not null check (type in ('hotel','bus_tour','attraction','other')),  -- 資料: ホテル/宿泊・バス/送迎/ツアー・観光施設
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 追加補償オプションマスタ(任意加入・料金は未確定のためマスタ管理)
create table insurance_addons (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null,                     -- ロケール別名称
  price_vnd bigint not null,
  coverage_limit_vnd bigint not null,      -- 例: 補償上限を10,000,000に引き上げ
  is_active boolean not null default true
);

-- 問い合わせ
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  booking_no text,
  body text not null,
  status text not null default 'open' check (status in ('open','closed')),
  admin_note text,
  created_at timestamptz not null default now()
);

-- OTAバウチャー(レベル2用。PoCではテーブルのみ作成)
create table ota_vouchers (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('trip','klook','kkday')),
  code text unique not null,
  size text not null check (size in ('S','M','L')),
  plan_hours int not null check (plan_hours in (3,6,12)),
  redeemed_booking_id uuid references bookings(id),
  redeemed_at timestamptz,
  imported_at timestamptz not null default now()
);

-- 監査ログ
create table audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_type text not null,                -- 'guest' | 'staff' | 'admin' | 'system'
  actor_id text,                           -- staff.id / admin user id / booking_token
  action text not null,                    -- 'BOOKING_CREATED','OTP_VERIFY_FAIL','ITEM_STORED',...
  booking_id uuid,
  item_id uuid,
  detail jsonb
);

create sequence booking_no_seq;
```

## 制約・インデックス

- `bookings(store_id, visit_date, status)`、`booking_items(booking_id)`、`audit_logs(booking_id)` にインデックス
- 容量チェック: `visit_date` × `store_id` の `capacity_holds`(released=false)合計 + 新規ポイント ≤ `stores.capacity_points`。**予約作成トランザクション内で `select ... for update` により直列化**(オーバーブッキング防止)

## seed データ

- 店舗3件(BT/BV: capacity 20pt, 営業 07:00–23:00。AP: 30pt, 24h)
- 各店舗スタッフ2名
- price_plans 9行(確定値): S=50,000/70,000/100,000・M=70,000/100,000/150,000・L=100,000/150,000/200,000(3h/6h/12h)。points S=1,M=2,L=3
- 管理者ユーザー1件(Supabase Auth, email: admin@example.com / パスワードは .env.example に記載)
