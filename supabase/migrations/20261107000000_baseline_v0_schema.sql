-- =============================================================================
-- BASELINE do schema criado pelo V0 (migration "create_reservations_and_profiles").
--
-- Por que existe: o schema atual do projeto Supabase `hyxz…` foi criado pelo V0
-- e não estava versionado no repositório. Este arquivo documenta e permite
-- recriar o MESMO desenho em ambientes novos (Preview/Desenvolvimento).
--
-- IMPORTANTE
--  * Em `hyxz…` essas tabelas JÁ EXISTEM: este arquivo é idempotente
--    (create ... if not exists) e não altera nem apaga nada nelas.
--  * Políticas RLS, grants e dados de exemplo foram DE PROPÓSITO deixados de fora:
--    as políticas originais do V0 eram inseguras e são substituídas integralmente
--    pela migration seguinte (20261109000000_auth_foundation_security.sql).
--  * NÃO execute migrations em produção sem revisão. Aplique primeiro em um
--    projeto de desenvolvimento.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','staff','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  scheduled_at timestamptz not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservations_user_id_idx on public.reservations(user_id);
create index if not exists reservations_scheduled_at_idx on public.reservations(scheduled_at);

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.reservations enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
