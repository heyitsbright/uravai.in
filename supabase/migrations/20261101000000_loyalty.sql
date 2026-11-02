create extension if not exists pgcrypto;

create table if not exists public.loyalty_customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\+91[6-9][0-9]{9}$'),
  customer_name text not null check (length(customer_name) between 1 and 80),
  access_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.loyalty_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.loyalty_customers(id) on delete restrict,
  order_number text not null unique check (length(order_number) between 1 and 40),
  order_date date not null,
  product text not null check (length(product) between 1 and 80),
  amount_paise integer not null check (amount_paise >= 0),
  points integer not null check (points >= 0),
  invoice_path text,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_orders_customer_date_idx
  on public.loyalty_orders (customer_id, order_date desc, created_at desc);

create table if not exists public.loyalty_attempts (
  attempt_key text primary key,
  attempt_count integer not null,
  reset_at timestamptz not null
);

alter table public.loyalty_customers enable row level security;
alter table public.loyalty_orders enable row level security;
alter table public.loyalty_attempts enable row level security;

revoke all on public.loyalty_customers, public.loyalty_orders, public.loyalty_attempts from anon, authenticated;
grant all on public.loyalty_customers, public.loyalty_orders, public.loyalty_attempts to service_role;

create or replace function public.loyalty_allow_attempt(
  p_key text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  insert into public.loyalty_attempts (attempt_key, attempt_count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (attempt_key) do update
    set attempt_count = case
      when public.loyalty_attempts.reset_at <= now() then 1
      else public.loyalty_attempts.attempt_count + 1
    end,
    reset_at = case
      when public.loyalty_attempts.reset_at <= now()
        then now() + make_interval(secs => p_window_seconds)
      else public.loyalty_attempts.reset_at
    end
  returning attempt_count into v_count;
  return v_count <= p_max;
end;
$$;

revoke all on function public.loyalty_allow_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.loyalty_allow_attempt(text, integer, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uravai-bills', 'uravai-bills', false, 6291456, array['application/pdf'])
on conflict (id) do nothing;
