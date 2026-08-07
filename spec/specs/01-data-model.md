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
  channel_tier text not null default 'direct'
    check (channel_tier in ('direct','ota')),  -- OTA向けは別価格(手数料15-35%吸収)。08レベル2用に先行予約
  valid_from date not null default current_date,
  unique(size, plan_hours, channel_tier, valid_from)
);
-- 料金参照は「size×plan_hours×channel_tier の valid_from<=today 最新行」。
-- PoCは全予約 channel_tier='direct'。OTA行(=ota)は 08 レベル2 稼働時に追加(直販行はそのまま)。

-- スカラー料金設定マスタ(超過単価・打ち止め時間・日額・各種手数料など。画面から変更可能)
-- サイズ×時間の料金は price_plans、単発の金額系はここで管理。ハードコード禁止。
create table fee_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key in (
    'overtime_grace_minutes',   -- 超過の無料猶予(分)(既定 15)
    'overtime_hourly_vnd',      -- 超過単価/時(既定 10,000)
    'overtime_cap_hours',       -- 超過打ち止め時間(既定 24)
    'daily_storage_fee_vnd',    -- 打ち止め後の日額(★調査中・未確定。決定後に設定)
    'cancellation_fee_vnd',     -- 利用者キャンセル手数料(既定 20,000)
    'noshow_fee_vnd',           -- no-show手数料(既定 20,000)
    'relocate_after_days',      -- 保管拠点へ移送するまでの日数(既定 7)
    'insurance_limit_item_vnd', -- 基本補償: 1荷物上限(既定 5,000,000)
    'insurance_limit_booking_vnd' -- 基本補償: 1予約上限(既定 10,000,000)
  )),
  value_vnd bigint,                        -- 金額/数値。未定は null(例: daily_storage_fee_vnd)
  effective_from date not null default current_date,
  note text,
  unique(key, effective_from)
);
-- 実装: 参照は「key の effective_from<=today の最新行」。予約時に使った値は該当予約にスナップショット保存。
-- daily_storage_fee_vnd は当初 null(未確定)。null の間は日額課金を発生させない(0扱い)＋管理者へ要設定を通知。

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
    check (channel in ('direct','organic','ota','referral','store','sns')),  -- 集計用の粗カテゴリ(安定・小集合)
  channel_code text,                       -- 具体的な流入元コード(sales_channels.code)。例 'trip','klook','agoda','google','hotel_abc'。任意サイトは行追加で対応(ハードコードしない)
  referral_code text,                      -- partners.code(紹介パートナー経由時)
  external_ref text,                       -- OTAバウチャーコード/OTA予約番号(レベル2用)
  insurance_addon_vnd bigint not null default 0,  -- 任意の追加補償オプション料金(0=基本補償のみ)
  storage_started_at timestamptz,
  return_due_at timestamptz,
  cancelled_reason text,                   -- 'no_show' | 'user_request' | 'prohibited_item'
  refund_amount_vnd bigint,
  refund_status text not null default 'none'
    check (refund_status in ('none','pending','done')),  -- 返金は方法問わず記録。PoCは pending=運営手動処理(12.9)
  daily_storage_fee_vnd bigint not null default 0,        -- 24h打ち止め後の日額保管料の累計(12.2)
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
  daily_storage_fee_vnd bigint not null default 0,  -- 24h打ち止め後の日額累計(item単位)
  overtime_settled boolean not null default false,
  size_adjustment_vnd bigint not null default 0     -- サイズ修正の差額(店頭精算。負=返金相当。12.10-B)
);

-- 返却用OTP(都度発行・短命)
create table pickup_otps (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  otp_hash text not null,
  otp_plain text,                          -- 予約ページ表示用(06の例外)。有効期間内のみ保持、使用/失効時に null 化
  expires_at timestamptz not null,         -- 発行+10分
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- 容量確保(予約時に押さえる)。容量は「時間帯の重なり」で判定する(12.4)
create table capacity_holds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  booking_id uuid not null references bookings(id),
  points int not null,
  occupy_start timestamptz not null,       -- 占有開始(arrival_slot_start→実預入で storage_started_at)
  occupy_end timestamptz not null,         -- 占有終了(予定=return_due_at。早期受取で now、超過は実際に店舗を出るまで延長)
  released boolean not null default false,  -- 荷物が店舗から出た(返却 or 保管拠点へ移送)時に true
  released_at timestamptz
);
-- 重なり判定用インデックス: (store_id, occupy_start, occupy_end) where released=false

-- 販売/流入チャネル レジストリ(OTA・検索・SNS等をデータで管理。新規サイトは行追加で対応=ハードコード禁止)
create table sales_channels (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- 'direct','google','maps','trip','klook','kkday','agoda','getyourguide','sns',...
  name text not null,
  channel_type text not null               -- bookings.channel と同じ粗カテゴリ
    check (channel_type in ('direct','organic','ota','referral','store','sns')),
  commission_rate numeric(5,4) default 0,  -- OTA手数料率(0.15-0.35等)。精算・純貢献計算に使用。未定はnull可
  supports_voucher boolean not null default false,  -- レベル2バウチャー償還対象か
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- 参照: bookings.channel_code / ota_vouchers.provider は sales_channels.code を指す(緩い参照)。
-- 新しいOTA(例 Agoda/GetYourGuide)への対応は「sales_channels に1行 + 必要なら price_plans に ota価格行」を追加するだけ。マイグレーション不要。

-- 紹介パートナー(ホテル・バス・ツアー会社等。オフラインの紹介元。sales_channels(type=referral)と併用可)
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
  provider text not null,                   -- sales_channels.code(緩い参照)。ハードコードのcheckは付けない=任意OTA対応
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
- 容量チェック(**12.4が正**): 日付単位ではなく **`[occupy_start, occupy_end)` の時間帯の重なり**で判定する。新規予約区間と重なる有効ホールド(released=false)の `Σ points` + 新規ポイント ≤ `stores.capacity_points`。**予約作成トランザクション内で対象店舗の該当区間を `select ... for update` 等で直列化**(オーバーブッキング防止・夜またぎ漏れ防止=12.4 C4)。※日付ベースの合計判定は不可(旧モデル。夜またぎを取りこぼす)
- インデックス補足: 重なり判定用に `capacity_holds(store_id, occupy_start, occupy_end) where released=false`

## seed データ

- 店舗3件(BT/BV: capacity 20pt。AP: 30pt)。**PoCの3店舗はすべて24時間営業**(open 00:00 / close 24:00)
- 各店舗スタッフ2名
- price_plans 9行(確定値・全て channel_tier='direct'): S=50,000/70,000/100,000・M=70,000/100,000/150,000・L=100,000/150,000/200,000(3h/6h/12h)。points S=1,M=2,L=3。OTA行(channel_tier='ota')は 08 レベル2 稼働時に追加
- fee_settings 初期値: overtime_grace_minutes=15 / overtime_hourly_vnd=10,000 / overtime_cap_hours=24 / cancellation_fee_vnd=20,000 / noshow_fee_vnd=20,000 / relocate_after_days=7 / insurance_limit_item_vnd=5,000,000 / insurance_limit_booking_vnd=10,000,000 / **daily_storage_fee_vnd=null(未確定・調査中)**
- sales_channels 初期行(例): direct(direct)/google(organic)/maps(organic)/trip(ota,0.25)/klook(ota,0.25)/kkday(ota,0.25)/hotel(referral)/bus_tour(referral)/store_poster(store)/sns(sns)。**新規OTAは行追加で対応**(Agoda等)。commission_rateは目安・契約で更新
- 管理者ユーザー1件(Supabase Auth, email: admin@example.com / パスワードは .env.example に記載)
- 店舗アカウント3件(Supabase Auth, `app_metadata: {role:'store', store_id}`。email/パスワードは .env.example に記載。詳細は specs/16)
