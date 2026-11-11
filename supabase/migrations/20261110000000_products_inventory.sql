-- Controle de produtos: preço, estoque, vendas e publicação na vitrine.
-- NÃO aplicada automaticamente. Aplicar primeiro em um projeto de desenvolvimento.
-- Depende de 20261109000000_auth_foundation_security.sql (is_staff()).
begin;

create table if not exists public.products (
  id          bigint generated always as identity primary key,
  name        text    not null check (char_length(btrim(name)) between 2 and 120),
  description text    not null default '' check (char_length(description) <= 600),
  category    text    not null default 'Banhos' check (char_length(btrim(category)) between 1 and 60),
  tag         text    not null default '' check (char_length(tag) <= 30),
  price       numeric(10,2) not null check (price >= 0 and price <= 99999.99),
  stock       integer not null default 0 check (stock >= 0),
  sold_count  integer not null default 0 check (sold_count >= 0),
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Regra de negócio também no banco: só pode estar publicado com estoque.
  constraint products_published_needs_stock check (not published or stock > 0)
);

comment on table public.products is
  'Produtos da loja. published só é permitido com stock > 0; ao zerar o estoque o produto é despublicado.';

-- Regras: (1) publicar exige estoque; (2) estoque zerado despublica; (3) updated_at.
create or replace function public.products_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.published and new.stock <= 0 then
    if tg_op = 'UPDATE' and old.published and new.stock = 0 then
      new.published := false;            -- esgotou: sai da vitrine sozinho
    else
      raise exception 'Não é possível publicar um produto sem estoque.' using errcode = '23514';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_guard on public.products;
create trigger products_guard before insert or update on public.products
  for each row execute function public.products_guard();

-- Venda atômica: baixa o estoque e soma às vendas. Falha se não houver estoque suficiente.
create or replace function public.register_product_sale(p_product_id bigint, p_quantity integer default 1)
returns public.products
language plpgsql
security invoker
set search_path = ''
as $$
declare r public.products;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantidade inválida.' using errcode = '22023';
  end if;
  update public.products
     set stock = stock - p_quantity, sold_count = sold_count + p_quantity
   where id = p_product_id and stock >= p_quantity
   returning * into r;
  if not found then
    raise exception 'Estoque insuficiente ou produto inexistente.' using errcode = '23514';
  end if;
  return r;
end;
$$;
revoke all on function public.register_product_sale(bigint, integer) from public, anon;
grant execute on function public.register_product_sale(bigint, integer) to authenticated;

-- Acesso: a tabela é só da equipe (RLS + is_staff()).
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;

drop policy if exists "products_staff_all" on public.products;
create policy "products_staff_all" on public.products
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Vitrine pública: só produtos publicados e com estoque, sem expor estoque nem vendas.
-- A view roda com os privilégios do dono (ignora a RLS da tabela) de propósito; ela filtra
-- linhas e colunas. O Advisor do Supabase pode avisar sobre isso: é esperado.
drop view if exists public.products_public;
create view public.products_public as
  select id, name, description, category, tag, price
    from public.products
   where published and stock > 0;
grant select on public.products_public to anon, authenticated;

commit;
