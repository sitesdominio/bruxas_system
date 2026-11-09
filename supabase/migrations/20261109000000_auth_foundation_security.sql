-- =============================================================================
-- FUNDAÇÃO DE SEGURANÇA DA AUTENTICAÇÃO — Olho da Bruxa (Etapa 1)
--
-- NÃO FOI APLICADA A NENHUM BANCO. Revise `supabase/README.md` antes de executar
-- e aplique primeiro em um projeto de desenvolvimento.
--
-- O que esta migration corrige (todas as correções vêm de falhas encontradas na
-- auditoria das políticas criadas pelo V0):
--   P1  Cliente podia virar admin: `profiles_update_own` não limitava colunas.
--   P2  Cliente podia confirmar/concluir a própria reserva e editar qualquer campo.
--   P3  Não havia nenhum GRANT: o Supabase não expõe mais tabelas novas à Data API
--       automaticamente, então o acesso precisa ser concedido de forma explícita.
--   P9  Perfis ausentes para contas antigas e entradas de texto sem limite.
--
-- O que NÃO faz: não apaga tabelas, colunas ou dados; não cria serviços; não
-- implementa funcionalidades de agendamento.
-- Idempotente: pode ser reexecutada sem erro.
-- =============================================================================

begin;

-- 1) Papéis administrativos em tabela própria, fora do alcance do cliente ------
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('staff','admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;

comment on table public.user_roles is
  'Papéis administrativos. Somente leitura do próprio papel para o usuário; escrita apenas pelo painel SQL / service_role no servidor.';
comment on column public.profiles.role is
  'LEGADO (V0). NÃO usar para autorização: o papel efetivo vem de public.user_roles via is_staff()/is_admin().';

-- 2) Funções de autorização (SECURITY DEFINER, search_path vazio) ---------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()))
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin')
$$;

revoke all on function public.is_staff() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 3) updated_at automático ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

-- 4) Criação automática do perfil (mesma lógica, com limites de tamanho) ---------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    left(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), 30)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contas criadas antes do trigger ficaram sem perfil: cria os que faltam.
-- (Somente INSERT; não altera nem remove nenhum perfil existente.)
insert into public.profiles (id, full_name, phone)
select u.id,
       left(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), 120),
       left(nullif(btrim(u.raw_user_meta_data ->> 'phone'), ''), 30)
from auth.users u
on conflict (id) do nothing;

-- 5) Limites de tamanho (NOT VALID: não falha por linhas antigas; vale para novas) --
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_full_name_len') then
    alter table public.profiles add constraint profiles_full_name_len
      check (full_name is null or char_length(full_name) <= 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_phone_len') then
    alter table public.profiles add constraint profiles_phone_len
      check (phone is null or char_length(phone) <= 30) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_customer_name_len') then
    alter table public.reservations add constraint reservations_customer_name_len
      check (char_length(customer_name) <= 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_customer_phone_len') then
    alter table public.reservations add constraint reservations_customer_phone_len
      check (char_length(customer_phone) <= 30) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_notes_len') then
    alter table public.reservations add constraint reservations_notes_len
      check (notes is null or char_length(notes) <= 1000) not valid;
  end if;
end $$;

-- 6) profiles ---------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_own_or_staff" on public.profiles;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- O cliente só pode editar nome e telefone. `role`, `id` e datas ficam bloqueados.
grant update (full_name, phone) on public.profiles to authenticated;

create policy "profiles_select_own_or_staff" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.is_staff());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
-- Sem INSERT/DELETE para clientes: o perfil nasce pelo trigger handle_new_user.

-- 7) user_roles -------------------------------------------------------------------
drop policy if exists "user_roles_select_own" on public.user_roles;

revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

create policy "user_roles_select_own" on public.user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- Sem políticas de escrita: ninguém concede papel por requisição de cliente.

-- 8) services -----------------------------------------------------------------------
drop policy if exists "services_public_read_active" on public.services;
drop policy if exists "services_read_active" on public.services;
drop policy if exists "services_read_all_staff" on public.services;

revoke all on public.services from anon, authenticated;
grant select on public.services to anon, authenticated;

-- Duas políticas separadas: a de visitantes não chama is_staff() (sem EXECUTE para anon).
create policy "services_read_active" on public.services
  for select to anon, authenticated
  using (active = true);

create policy "services_read_all_staff" on public.services
  for select to authenticated
  using (public.is_staff());

-- 9) reservations -------------------------------------------------------------------
drop policy if exists "reservations_select_own" on public.reservations;
drop policy if exists "reservations_insert_own" on public.reservations;
drop policy if exists "reservations_update_staff_or_own_pending" on public.reservations;
drop policy if exists "reservations_select_own_or_staff" on public.reservations;
drop policy if exists "reservations_cancel_own" on public.reservations;
drop policy if exists "reservations_update_staff" on public.reservations;

revoke all on public.reservations from anon, authenticated;
grant select on public.reservations to authenticated;
-- INSERT: só estas colunas. `status` fica de fora, então nasce sempre 'pending'.
grant insert (user_id, service_id, customer_name, customer_phone, scheduled_at, notes)
  on public.reservations to authenticated;
-- UPDATE: somente a coluna `status`.
grant update (status) on public.reservations to authenticated;

create policy "reservations_select_own_or_staff" on public.reservations
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_staff());

create policy "reservations_insert_own" on public.reservations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- O dono só pode CANCELAR uma reserva que ainda está pendente ou confirmada.
create policy "reservations_cancel_own" on public.reservations
  for update to authenticated
  using ((select auth.uid()) = user_id and status in ('pending','confirmed'))
  with check ((select auth.uid()) = user_id and status = 'cancelled');

-- A equipe pode alterar o status (confirmar, concluir, cancelar).
create policy "reservations_update_staff" on public.reservations
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
-- Sem DELETE para ninguém via API.

commit;
