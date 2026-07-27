create extension if not exists pgcrypto;

create type booking_status as enum (
  'draft',
  'payment_pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'expired'
);

create type payment_status as enum (
  'requires_action',
  'authorized',
  'captured',
  'failed',
  'refunded'
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  capacity_small integer not null default 0 check (capacity_small >= 0),
  capacity_large integer not null default 0 check (capacity_large >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  customer_email text not null,
  customer_phone text,
  status booking_status not null default 'draft',
  bags_small integer not null default 0 check (bags_small >= 0),
  bags_large integer not null default 0 check (bags_large >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  amount_vnd bigint not null check (amount_vnd >= 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (ends_at > starts_at),
  constraint bookings_bag_count check (bags_small + bags_large > 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  provider text not null,
  provider_payment_id text not null,
  status payment_status not null,
  amount_vnd bigint not null check (amount_vnd >= 0),
  currency text not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  otp_hash text not null,
  purpose text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.stores enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.audit_logs enable row level security;

-- Deliberately no anon/authenticated policies yet: service-role-only access until API rules are implemented.
