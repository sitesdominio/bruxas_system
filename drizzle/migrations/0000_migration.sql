
create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text, email text, phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null, unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile ins" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile upd" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, name, phone) values (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'phone') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- first admin bootstrap
create or replace function public.claim_first_admin() returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.user_roles where role='admin') then return false; end if;
  insert into public.user_roles(user_id, role) values (auth.uid(),'admin');
  return true;
end $$;
create or replace function public.admin_exists() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where role='admin') $$;

-- settings
create table public.settings (key text primary key, value text);
grant select on public.settings to anon, authenticated;
grant insert, update, delete on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;
create policy "public settings read" on public.settings for select using (key in ('shipping_fee','store_address','whatsapp','instagram'));
create policy "admin settings read" on public.settings for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin settings write" on public.settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.settings values ('shipping_fee','15.00'),('store_address','Retirada na loja — endereço a confirmar'),('notify_email',''),('whatsapp','5551982536937'),('instagram','');

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text, validity text,
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  image_url text, active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products public" on public.products for select using (active or public.has_role(auth.uid(),'admin'));
create policy "products admin" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.products(name,description,validity,price,stock) values
('Banho de Prosperidade','Ervas para atrair abundância e abrir caminhos.','6 meses',39.90,10),
('Banho de Proteção','Arruda, guiné e alecrim para limpeza energética.','6 meses',34.90,8),
('Banho do Amor','Rosas e canela para autoestima e afeto.','6 meses',42.00,5),
('Banho de Descarrego','Sal grosso e ervas para aliviar o peso do dia.','6 meses',29.90,0);

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  customer_name text, customer_email text, customer_phone text,
  delivery_type text not null check (delivery_type in ('entrega','retirada')),
  address jsonb,
  subtotal numeric(10,2) not null, shipping numeric(10,2) not null default 0, total numeric(10,2) not null,
  status text not null default 'aguardando_pagamento',
  payment_status text not null default 'pendente',
  payment_id text unique,
  created_at timestamptz not null default now()
);
create index on public.orders(user_id);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders own" on public.orders for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "orders admin upd" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null, unit_price numeric(10,2) not null, quantity int not null check (quantity > 0)
);
create index on public.order_items(order_id);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "items own" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.has_role(auth.uid(),'admin'))));

-- prices and stock computed on server, atomic decrement
create or replace function public.create_order(_items jsonb, _delivery_type text, _address jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _order uuid; _sub numeric := 0; _ship numeric := 0; it jsonb; p record; q int; pr record;
begin
  if _uid is null then raise exception 'Faça login para comprar'; end if;
  if _delivery_type not in ('entrega','retirada') then raise exception 'Tipo de entrega inválido'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Carrinho vazio'; end if;
  select * into pr from public.profiles where id=_uid;
  if _delivery_type='entrega' then
    if _address is null or coalesce(_address->>'cep','')='' then raise exception 'Informe o endereço'; end if;
    select coalesce(value::numeric,0) into _ship from public.settings where key='shipping_fee';
  end if;
  insert into public.orders(user_id, customer_name, customer_email, customer_phone, delivery_type, address, subtotal, shipping, total)
  values (_uid, pr.name, pr.email, pr.phone, _delivery_type, case when _delivery_type='entrega' then _address end, 0, coalesce(_ship,0), 0) returning id into _order;
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'quantity')::int;
    if q is null or q < 1 or q > 50 then raise exception 'Quantidade inválida'; end if;
    update public.products set stock = stock - q where id = (it->>'product_id')::uuid and active and stock >= q returning * into p;
    if not found then raise exception 'Produto sem estoque suficiente'; end if;
    insert into public.order_items(order_id, product_id, name, unit_price, quantity) values (_order, p.id, p.name, p.price, q);
    _sub := _sub + p.price * q;
  end loop;
  update public.orders set subtotal=_sub, total=_sub+coalesce(_ship,0) where id=_order;
  return _order;
end $$;
grant execute on function public.create_order(jsonb,text,jsonb) to authenticated;

-- services / professionals / availability / appointments
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text, duration_min int not null default 60 check (duration_min between 15 and 480),
  price numeric(10,2) not null default 0, active boolean not null default true
);
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, whatsapp text, active boolean not null default true
);
create table public.professional_services (
  professional_id uuid references public.professionals(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  primary key (professional_id, service_id)
);
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null, end_time time not null check (end_time > start_time)
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_name text, customer_email text, customer_phone text,
  service_id uuid not null references public.services(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'confirmado' check (status in ('confirmado','concluido','cancelado')),
  notes text,
  created_at timestamptz not null default now()
);
create unique index appt_prof_slot on public.appointments(professional_id, starts_at) where status <> 'cancelado';
create unique index appt_user_service on public.appointments(user_id, service_id) where status = 'confirmado' and user_id is not null;
create index on public.appointments(starts_at);

grant select on public.services, public.professionals, public.professional_services, public.availability to anon, authenticated;
grant insert, update, delete on public.services, public.professionals, public.professional_services, public.availability to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.services, public.professionals, public.professional_services, public.availability, public.appointments to service_role;
alter table public.services enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_services enable row level security;
alter table public.availability enable row level security;
alter table public.appointments enable row level security;
create policy "svc read" on public.services for select using (active or public.has_role(auth.uid(),'admin'));
create policy "svc admin" on public.services for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "prof read" on public.professionals for select using (active or public.has_role(auth.uid(),'admin'));
create policy "prof admin" on public.professionals for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "ps read" on public.professional_services for select using (true);
create policy "ps admin" on public.professional_services for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "av read" on public.availability for select using (true);
create policy "av admin" on public.availability for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "ap own read" on public.appointments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "ap own cancel" on public.appointments for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "ap admin ins" on public.appointments for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "ap admin del" on public.appointments for delete to authenticated using (public.has_role(auth.uid(),'admin'));

-- busy slots (no personal data)
create or replace function public.busy_slots(_day date)
returns table(professional_id uuid, starts_at timestamptz, ends_at timestamptz) language sql stable security definer set search_path = public as $$
  select professional_id, starts_at, ends_at from public.appointments
  where status <> 'cancelado' and starts_at < (_day + 1)::timestamptz + interval '1 day' and ends_at > _day::timestamptz - interval '1 day'
$$;
grant execute on function public.busy_slots(date) to anon, authenticated;

create or replace function public.book_appointment(_service uuid, _professional uuid, _starts timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); s record; _ends timestamptz; pr record; _id uuid; _local timestamp;
begin
  if _uid is null then raise exception 'Faça login para agendar'; end if;
  select * into s from public.services where id=_service and active;
  if not found then raise exception 'Serviço indisponível'; end if;
  if not exists (select 1 from public.professional_services where professional_id=_professional and service_id=_service) then raise exception 'Profissional não atende este serviço'; end if;
  if _starts < now() then raise exception 'Horário no passado'; end if;
  _ends := _starts + make_interval(mins => s.duration_min);
  _local := _starts at time zone 'America/Sao_Paulo';
  if not exists (select 1 from public.availability a where a.professional_id=_professional and a.weekday=extract(dow from _local)::int
     and a.start_time <= _local::time and a.end_time >= (_ends at time zone 'America/Sao_Paulo')::time) then
    raise exception 'Fora do horário do profissional'; end if;
  if exists (select 1 from public.appointments where professional_id=_professional and status<>'cancelado' and starts_at < _ends and ends_at > _starts) then
    raise exception 'Horário já reservado'; end if;
  if exists (select 1 from public.appointments where user_id=_uid and status='confirmado' and starts_at < _ends and ends_at > _starts) then
    raise exception 'Você já tem um serviço neste horário'; end if;
  if exists (select 1 from public.appointments where user_id=_uid and service_id=_service and status='confirmado') then
    raise exception 'Você já tem um agendamento ativo para este serviço'; end if;
  select * into pr from public.profiles where id=_uid;
  insert into public.appointments(user_id, customer_name, customer_email, customer_phone, service_id, professional_id, starts_at, ends_at)
  values (_uid, pr.name, pr.email, pr.phone, _service, _professional, _starts, _ends) returning id into _id;
  return _id;
end $$;
grant execute on function public.book_appointment(uuid,uuid,timestamptz) to authenticated;

-- seed services
with s as (insert into public.services(name,description,duration_min,price) values
 ('Leitura de Tarot','Consulta com tiragem completa.',60,120),
 ('Benzimento','Limpeza energética tradicional.',30,60) returning id),
p as (insert into public.professionals(name,email,whatsapp) values ('Bruxa Responsável','', '5551982536937') returning id)
insert into public.professional_services select p.id, s.id from p, s;
insert into public.availability(professional_id, weekday, start_time, end_time)
select p.id, d, '09:00', '18:00' from public.professionals p, generate_series(1,5) d;
