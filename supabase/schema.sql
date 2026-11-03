-- Lucky Paddle database schema (Supabase / PostgreSQL)
-- Run this once in Supabase > SQL Editor. It is safe to run again.

create extension if not exists btree_gist;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  session_version int not null default 0 check (session_version >= 0),
  role text not null default 'admin' check (role in ('owner', 'admin')),
  active boolean not null default true,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists admin_users_active_idx on public.admin_users (active, role);
alter table public.admin_users add column if not exists session_version int not null default 0;
alter table public.admin_users drop constraint if exists admin_users_session_version_check;
alter table public.admin_users add constraint admin_users_session_version_check check (session_version >= 0);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  court int not null,
  hour int not null,
  duration int not null default 1 check (duration >= 1),
  amount int not null,
  status text not null default 'held'
    check (status in ('held', 'awaiting_review', 'approved', 'rejected')),
  expires_at timestamptz,
  name text,
  email text,
  phone text,
  reference text,
  paddles int not null default 0 check (paddles >= 0 and paddles <= 4),
  balls int not null default 0 check (balls >= 0),
  proof_path text,
  created_by text not null default 'customer' check (created_by in ('customer', 'admin')),
  reviewed_by uuid references public.admin_users(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Upgrade older installs that used the single-hour schema.
alter table public.bookings add column if not exists duration int not null default 1;
alter table public.bookings add column if not exists paddles int not null default 0;
alter table public.bookings add column if not exists balls int not null default 0;
alter table public.bookings add column if not exists proof_path text;
alter table public.bookings add column if not exists created_by text not null default 'customer';
alter table public.bookings add column if not exists reviewed_by uuid references public.admin_users(id) on delete set null;
alter table public.bookings add column if not exists reviewed_by_name text;
alter table public.bookings add column if not exists reviewed_at timestamptz;
alter table public.bookings drop constraint if exists bookings_paddles_check;
alter table public.bookings add constraint bookings_paddles_check check (paddles >= 0 and paddles <= 4);
alter table public.bookings drop constraint if exists bookings_created_by_check;
alter table public.bookings add constraint bookings_created_by_check check (created_by in ('customer', 'admin'));
alter table public.bookings drop constraint if exists one_active_booking_per_slot;
drop index if exists public.one_active_booking_per_slot;

-- Older statuses become approved/rejected so the new check constraint can be added.
alter table public.bookings drop constraint if exists bookings_status_check;
update public.bookings set status = 'approved' where status = 'paid';
update public.bookings set status = 'rejected' where status = 'expired';
alter table public.bookings add constraint bookings_status_check
  check (status in ('held', 'awaiting_review', 'approved', 'rejected'));

-- The database itself prevents overlapping active bookings.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    date with =,
    court with =,
    int4range(hour, hour + duration) with &&
  ) where (status in ('held', 'awaiting_review', 'approved'));

create index if not exists bookings_date_idx on public.bookings (date, court, hour);
create index if not exists bookings_status_idx on public.bookings (status, expires_at);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  court int not null,
  hour int not null,
  duration int not null default 1 check (duration >= 1),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.blocks drop constraint if exists blocks_no_overlap;
alter table public.blocks add constraint blocks_no_overlap
  exclude using gist (
    date with =,
    court with =,
    int4range(hour, hour + duration) with &&
  );

create index if not exists blocks_date_idx on public.blocks (date, court, hour);

create table if not exists public.inventory (
  id int primary key default 1 check (id = 1),
  paddles int not null default 4 check (paddles >= 0),
  balls int not null default 10 check (balls >= 0),
  updated_at timestamptz not null default now()
);

insert into public.inventory (id) values (1) on conflict (id) do nothing;

-- Payment receipts are private; the server accesses them with the service-role key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Only the server (service role key) touches these tables.
alter table public.bookings enable row level security;
alter table public.admin_users enable row level security;
alter table public.blocks enable row level security;
alter table public.inventory enable row level security;
alter table public.app_settings enable row level security;
