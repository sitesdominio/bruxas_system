-- Cópia EXATA do SQL aplicado pelo V0 em 07/11/2026 (migration "create_reservations_and_profiles").
-- Usada apenas como fixture do teste de atualização (supabase/tests/rls-pglite.mjs). NÃO aplicar.
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

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "services_public_read_active" on public.services for select using (active = true or exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin')));

create policy "reservations_select_own" on public.reservations for select using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin')));
create policy "reservations_insert_own" on public.reservations for insert with check (auth.uid() = user_id);
create policy "reservations_update_staff_or_own_pending" on public.reservations for update using (auth.uid() = user_id or exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin')));

insert into public.services (name, description, duration_minutes, price_cents)
select * from (values
  ('Banho ritual de ervas', 'Limpeza energética com ervas selecionadas.', 60, 8900),
  ('Consulta intuitiva', 'Leitura personalizada para seu momento atual.', 45, 12000),
  ('Ritual de proteção', 'Atendimento profundo para proteção e equilíbrio.', 75, 14900)
) as seed(name, description, duration_minutes, price_cents)
where not exists (select 1 from public.services);

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
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();