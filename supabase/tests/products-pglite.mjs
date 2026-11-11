/**
 * Testes da migration de produtos/estoque (20261110) sobre baseline + endurecimento, executados em um
 * Postgres local (PGlite, WebAssembly). NÃO é o Supabase: papéis (anon,
 * authenticated, service_role), o schema `auth` e auth.uid() são emulados.
 * Serve para provar a LÓGICA das políticas; a validação final deve ser repetida
 * em um projeto Supabase de desenvolvimento.
 *
 * Requer (não adicionado ao package.json): pnpm add -D @electric-sql/pglite
 * Execução: node supabase/tests/rls-pglite.mjs
 */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const sql = (dir, file) => readFileSync(new URL(`../${dir}/${file}`, import.meta.url), 'utf8')
const noExtLater = (s) => s.replace(/create extension if not exists pgcrypto;/g, '')
const BASELINE = noExtLater(sql('migrations', '20261107000000_baseline_v0_schema.sql'))
const HARDENING = sql('migrations', '20261109000000_auth_foundation_security.sql')
const PRODUCTS = sql('migrations', '20261110000000_products_inventory.sql')
// PGlite não traz a extensão pgcrypto; gen_random_uuid() já é nativo do Postgres.
const noExt = (s) => s.replace(/create extension if not exists pgcrypto;/g, '')
const V0_ORIGINAL = noExt(sql('tests/fixtures', 'v0-original-migration.sql'))

let falhas = 0, total = 0
const check = (nome, ok, detalhe = '') => {
  total++
  if (!ok) falhas++
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${nome}${!ok && detalhe ? `  -> ${detalhe}` : ''}`)
}

const ROLES = new Set(['anon', 'authenticated'])
async function as(db, who, query, params = []) {
  if (!ROLES.has(who.role) && who.role !== 'supabase_auth_admin') throw new Error('papel inválido')
  const claims = JSON.stringify(who.uid ? { sub: who.uid, role: who.role } : { role: who.role })
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
  await db.exec(`set role ${who.role}`)
  try {
    return { ok: true, res: await db.query(query, params) }
  } catch (e) {
    return { ok: false, err: String(e.message || e) }
  } finally {
    await db.exec('reset role')
  }
}
const negado = (r) => !r.ok
const zero = (r) => r.ok && r.res.affectedRows === 0
const linhas = (r) => (r.ok ? r.res.rows : [])

const U = {
  alice: '00000000-0000-0000-0000-00000000000a',
  bob: '00000000-0000-0000-0000-00000000000b',
  staff: '00000000-0000-0000-0000-0000000000c1',
  velha: '00000000-0000-0000-0000-0000000000d1', // conta antiga, sem perfil
}

async function novoBanco({ defaultGrantsLegados }) {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls; create role supabase_auth_admin nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
                             raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
    grant usage on schema auth to anon, authenticated, supabase_auth_admin;
    grant execute on function auth.uid() to anon, authenticated;
    grant select, insert on auth.users to supabase_auth_admin;
    grant usage on schema public to anon, authenticated, service_role;
  `)
  if (defaultGrantsLegados) {
    // Projetos antigos: tabelas novas em public já nasciam acessíveis à Data API.
    await db.exec(`alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;`)
  }
  return db
}

async function criarUsuarios(db) {
  // Inserção feita pelo papel do GoTrue (sem EXECUTE nas funções de public): prova que o trigger continua disparando.
  for (const [nome, id] of [['alice', U.alice], ['bob', U.bob], ['staff', U.staff]]) {
    const r = await as(db, { role: 'supabase_auth_admin' }, `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
      [id, `${nome}@teste.local`, JSON.stringify({ full_name: `  ${nome} Silva  `, phone: '11 99999-0000' })])
    if (!r.ok) throw new Error(`falha ao criar usuário ${nome}: ${r.err}`)
  }
}

async function semear(db) {
  await db.exec(`insert into public.services (name, description, duration_minutes, price_cents, active) values
    ('Serviço ativo de teste','x',60,1000,true), ('Serviço inativo de teste','x',60,1000,false);`)
  await db.query(`insert into public.user_roles (user_id, role) values ($1, 'staff')`, [U.staff])
  const svc = (await db.query(`select id from public.services where active`)).rows[0].id
  return svc
}


console.log('\n=== PRODUTOS: estoque, publicação e RLS ===')
const db = await novoBanco({ defaultGrantsLegados: false })
await db.exec(BASELINE); await db.exec(HARDENING); await db.exec(PRODUCTS)
await criarUsuarios(db)
await db.query(`insert into public.user_roles (user_id, role) values ($1, 'staff')`, [U.staff])
const staff = { role: 'authenticated', uid: U.staff }, alice = { role: 'authenticated', uid: U.alice }, anon = { role: 'anon' }

let r = await as(db, staff, `insert into public.products (name, price, stock, published) values ('Banho A', 89.9, 5, true) returning id`)
check('staff cria produto publicado com estoque', r.ok, r.err)
const idA = linhas(r)[0]?.id
r = await as(db, staff, `insert into public.products (name, price, stock, published) values ('Sem estoque', 10, 0, true)`)
check('NÃO publica ao criar com estoque 0', negado(r), r.err)
r = await as(db, staff, `insert into public.products (name, price, stock) values ('Banho B', 50, 0) returning id`)
const idB = linhas(r)[0]?.id
check('staff cria produto oculto com estoque 0', r.ok && linhas(r)[0].id, r.err)
r = await as(db, staff, `update public.products set published = true where id = $1`, [idB])
check('NÃO publica produto com estoque 0', negado(r), r.err)
r = await as(db, staff, `update public.products set stock = 3, published = true where id = $1`, [idB])
check('publica após ter estoque', r.ok, r.err)
r = await as(db, staff, `insert into public.products (name, price, stock) values ('Preço negativo', -1, 1)`)
check('rejeita preço negativo', negado(r), r.err)
r = await as(db, staff, `insert into public.products (name, price, stock) values ('Estoque negativo', 1, -1)`)
check('rejeita estoque negativo', negado(r), r.err)

r = await as(db, staff, `select * from public.register_product_sale($1, 2)`, [idA])
check('venda baixa estoque e soma vendas', r.ok && linhas(r)[0].stock === 3 && linhas(r)[0].sold_count === 2, r.err)
r = await as(db, staff, `select * from public.register_product_sale($1, 99)`, [idA])
check('venda acima do estoque é recusada', negado(r), r.err)
r = await as(db, staff, `select * from public.register_product_sale($1, 3)`, [idA])
check('vender todo o estoque despublica automaticamente', r.ok && linhas(r)[0].stock === 0 && linhas(r)[0].published === false, r.err)

r = await as(db, anon, `select id, name, price from public.products_public order by id`)
check('anônimo vê só publicados com estoque pela view', r.ok && linhas(r).length === 1 && linhas(r)[0].id === idB, r.err)
r = await as(db, anon, `select stock from public.products`)
check('anônimo NÃO lê a tabela', negado(r), r.err)
r = await as(db, anon, `select stock from public.products_public`)
check('view pública não expõe estoque', negado(r), r.err)
r = await as(db, alice, `select * from public.products`)
check('cliente logado NÃO lê a tabela (estoque/vendas)', negado(r) || linhas(r).length === 0, r.err)
r = await as(db, alice, `update public.products set price = 1 where id = $1`, [idB])
check('cliente NÃO altera produto', negado(r) || zero(r), r.err)
r = await as(db, alice, `insert into public.products (name, price) values ('Invasor', 1)`)
check('cliente NÃO cria produto', negado(r), r.err)
r = await as(db, alice, `delete from public.products where id = $1`, [idB])
check('cliente NÃO exclui produto', negado(r) || zero(r), r.err)
r = await as(db, alice, `select * from public.register_product_sale($1, 1)`, [idB])
check('cliente NÃO registra venda', negado(r), r.err)
r = await as(db, anon, `select * from public.register_product_sale($1, 1)`, [idB])
check('anônimo NÃO registra venda', negado(r), r.err)
r = await as(db, staff, `delete from public.products where id = $1`, [idA])
check('staff exclui produto', r.ok && r.res.affectedRows === 1, r.err)

console.log(`\n${total - falhas}/${total} verificações passaram`)
process.exit(falhas ? 1 : 0)
