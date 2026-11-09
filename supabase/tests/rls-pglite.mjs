/**
 * Testes de RLS e permissões das migrations de autenticação, executados em um
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

// ============================================================================
console.log('\n=== CENÁRIO A: banco novo (baseline + endurecimento), sem grants automáticos ===')
{
  const db = await novoBanco({ defaultGrantsLegados: false })
  await db.exec(BASELINE)
  await db.exec(HARDENING)
  await criarUsuarios(db)
  const svc = await semear(db)

  const perfis = (await db.query(`select id, full_name, phone, role from public.profiles order by id`)).rows
  check('trigger cria perfil mesmo sem EXECUTE para o papel do Auth', perfis.length === 3)
  check('nome e telefone são limpos (trim) pelo trigger', perfis.find((p) => p.id === U.alice)?.full_name === 'alice Silva')

  // ---- profiles
  let r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.profiles set role = 'admin' where id = $1`, [U.alice])
  check('P1: cliente NÃO consegue se promover a admin (profiles.role)', negado(r), r.err)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.profiles set full_name = 'Alice Nova' where id = $1`, [U.alice])
  check('cliente edita o próprio nome', r.ok && r.res.affectedRows === 1)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.profiles set full_name = 'Hack' where id = $1`, [U.bob])
  check('cliente NÃO edita perfil de outra pessoa', zero(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `select id from public.profiles`)
  check('cliente só enxerga o próprio perfil', linhas(r).length === 1 && linhas(r)[0].id === U.alice)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `insert into public.profiles (id, role) values (gen_random_uuid(), 'admin')`)
  check('cliente NÃO cria perfil por requisição direta', negado(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `delete from public.profiles where id = $1`, [U.alice])
  check('cliente NÃO apaga perfil', negado(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `select updated_at > created_at as mudou from public.profiles where id = $1`, [U.alice])
  check('updated_at é atualizado pelo trigger', linhas(r)[0]?.mudou === true)
  r = await as(db, { role: 'anon' }, `select * from public.profiles`)
  check('visitante (anon) NÃO lê perfis', negado(r))

  // ---- user_roles
  r = await as(db, { role: 'authenticated', uid: U.alice }, `insert into public.user_roles (user_id, role) values ($1, 'admin')`, [U.alice])
  check('cliente NÃO se concede papel em user_roles', negado(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `select * from public.user_roles`)
  check('cliente vê zero papéis (não há linhas dele)', r.ok && linhas(r).length === 0)
  r = await as(db, { role: 'authenticated', uid: U.staff }, `select role from public.user_roles`)
  check('equipe vê apenas o próprio papel', linhas(r).length === 1 && linhas(r)[0].role === 'staff')
  r = await as(db, { role: 'authenticated', uid: U.staff }, `insert into public.user_roles (user_id, role) values ($1, 'admin')`, [U.staff])
  check('nem a equipe concede papéis por requisição', negado(r))
  r = await as(db, { role: 'anon' }, `select * from public.user_roles`)
  check('anon NÃO lê user_roles', negado(r))

  // ---- funções
  r = await as(db, { role: 'anon' }, `select public.is_staff()`)
  check('anon NÃO executa is_staff()', negado(r))
  r = await as(db, { role: 'authenticated', uid: U.staff }, `select public.is_staff() as s`)
  check('is_staff() verdadeiro para a equipe', linhas(r)[0]?.s === true)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `select public.is_staff() as s, public.is_admin() as a`)
  check('is_staff()/is_admin() falsos para cliente', linhas(r)[0]?.s === false && linhas(r)[0]?.a === false)

  // ---- services
  r = await as(db, { role: 'anon' }, `select name from public.services`)
  check('anon lê só serviços ativos (sem erro de função)', r.ok && linhas(r).length === 1 && linhas(r)[0].name.includes('ativo'))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `select name from public.services`)
  check('cliente logado lê só serviços ativos', linhas(r).length === 1)
  r = await as(db, { role: 'authenticated', uid: U.staff }, `select name from public.services`)
  check('equipe lê todos os serviços', linhas(r).length === 2)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.services set price_cents = 1`)
  check('cliente NÃO altera serviços', negado(r))

  // ---- reservations
  const ins = (uid, extra = '') => as(db, { role: 'authenticated', uid },
    `insert into public.reservations (user_id, service_id, customer_name, customer_phone, scheduled_at${extra ? ', ' + extra.split('=')[0] : ''})
     values ($1, $2, 'Alice', '11 99999-0000', now() + interval '2 day'${extra ? ', ' + extra.split('=')[1] : ''}) returning id, status`, [uid, svc])
  r = await ins(U.alice)
  check('cliente cria reserva própria e ela nasce "pending"', r.ok && linhas(r)[0].status === 'pending', r.err)
  const resAlice = linhas(r)[0]?.id
  r = await ins(U.alice, "status='confirmed'")
  check('P2: cliente NÃO cria reserva já "confirmed"', negado(r), r.err)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `insert into public.reservations (user_id, service_id, customer_name, customer_phone, scheduled_at)
     values ($1, $2, 'X', '1', now() + interval '1 day')`, [U.bob, svc])
  check('cliente NÃO cria reserva em nome de outra pessoa', negado(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `insert into public.reservations (user_id, service_id, customer_name, customer_phone, scheduled_at)
     values ($1, $2, $3, '1', now() + interval '1 day')`, [U.alice, svc, 'x'.repeat(121)])
  check('texto acima do limite (120) é recusado', negado(r))

  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.reservations set status = 'confirmed' where id = $1`, [resAlice])
  check('P2: cliente NÃO confirma a própria reserva', negado(r), r.err)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.reservations set status = 'completed' where id = $1`, [resAlice])
  check('P2: cliente NÃO conclui a própria reserva', negado(r), r.err)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.reservations set scheduled_at = now() + interval '9 day' where id = $1`, [resAlice])
  check('cliente NÃO altera data/outros campos da reserva', negado(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.reservations set user_id = $2 where id = $1`, [resAlice, U.bob])
  check('cliente NÃO transfere a reserva para outro usuário', negado(r))
  r = await as(db, { role: 'authenticated', uid: U.bob }, `select id from public.reservations`)
  check('outro cliente NÃO vê reservas alheias', r.ok && linhas(r).length === 0)
  r = await as(db, { role: 'authenticated', uid: U.bob }, `update public.reservations set status = 'cancelled' where id = $1`, [resAlice])
  check('outro cliente NÃO cancela reserva alheia', zero(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `delete from public.reservations where id = $1`, [resAlice])
  check('cliente NÃO apaga reservas (sem DELETE)', negado(r))
  r = await as(db, { role: 'anon' }, `select * from public.reservations`)
  check('anon NÃO lê reservas', negado(r))
  r = await as(db, { role: 'anon' }, `insert into public.reservations (user_id, service_id, customer_name, customer_phone, scheduled_at) values ($1,$2,'x','1',now())`, [U.alice, svc])
  check('anon NÃO cria reservas', negado(r))

  r = await as(db, { role: 'authenticated', uid: U.staff }, `select id from public.reservations`)
  check('equipe enxerga todas as reservas', linhas(r).length === 1)
  r = await as(db, { role: 'authenticated', uid: U.staff }, `update public.reservations set status = 'confirmed' where id = $1`, [resAlice])
  check('equipe confirma reserva', r.ok && r.res.affectedRows === 1)
  r = await as(db, { role: 'authenticated', uid: U.staff }, `update public.reservations set scheduled_at = now() where id = $1`, [resAlice])
  check('equipe NÃO edita outras colunas pela API (por enquanto)', negado(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.reservations set status = 'cancelled' where id = $1`, [resAlice])
  check('dono CANCELA a própria reserva confirmada', r.ok && r.res.affectedRows === 1)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.reservations set status = 'pending' where id = $1`, [resAlice])
  check('dono NÃO "descancela" a reserva', zero(r) || negado(r))
  r = await as(db, { role: 'authenticated', uid: U.alice }, `select updated_at > created_at as mudou from public.reservations where id = $1`, [resAlice])
  check('updated_at da reserva é mantido pelo trigger', linhas(r)[0]?.mudou === true)

  await db.close()
}

// ============================================================================
console.log('\n=== CENÁRIO B: projeto JÁ criado pelo V0 (SQL original, grants automáticos legados) ===')
{
  const db = await novoBanco({ defaultGrantsLegados: true })
  await db.exec(V0_ORIGINAL)
  await criarUsuarios(db)
  // conta antiga sem perfil
  await db.query(`insert into auth.users (id, email) values ($1, 'velha@teste.local')`, [U.velha])
  await db.query(`delete from public.profiles where id = $1`, [U.velha])
  const svc = (await db.query(`select id from public.services order by name limit 1`)).rows[0].id
  const resBob = (await db.query(
    `insert into public.reservations (user_id, service_id, customer_name, customer_phone, scheduled_at) values ($1,$2,'Bob','11',now()+interval '3 day') returning id`, [U.bob, svc])).rows[0].id

  console.log('  -- ANTES da correção (comprovando as falhas encontradas):')
  let r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.profiles set role = 'admin' where id = $1`, [U.alice])
  check('[antes] cliente consegue se promover a admin (falha P1 reproduzida)', r.ok && r.res.affectedRows === 1)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `select id from public.reservations where user_id = $1`, [U.bob])
  check('[antes] o "admin" improvisado lê a reserva de OUTRA pessoa (vazamento reproduzido)', r.ok && linhas(r).length === 1)
  r = await as(db, { role: 'authenticated', uid: U.bob }, `update public.reservations set status = 'completed' where id = $1`, [resBob])
  check('[antes] cliente conclui a própria reserva sozinho (falha P2 reproduzida)', r.ok && r.res.affectedRows === 1)

  console.log('  -- APLICANDO baseline + endurecimento sobre o banco existente:')
  let erro = null
  try { await db.exec(BASELINE); await db.exec(HARDENING) } catch (e) { erro = e.message }
  check('migrations aplicam sem erro sobre o schema do V0', erro === null, erro || '')
  let erro2 = null
  try { await db.exec(BASELINE); await db.exec(HARDENING) } catch (e) { erro2 = e.message }
  check('migrations são idempotentes (segunda execução sem erro)', erro2 === null, erro2 || '')

  console.log('  -- DEPOIS da correção:')
  const prof = (await db.query(`select count(*)::int as n from public.profiles`)).rows[0].n
  check('conta antiga sem perfil recebeu perfil (backfill)', prof === 4, `perfis=${prof}`)
  const dados = (await db.query(`select count(*)::int as n from public.reservations`)).rows[0].n
  check('nenhuma reserva foi apagada pela migration', dados === 1)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `select id from public.reservations where user_id = $1`, [U.bob])
  check('role "admin" legado em profiles NÃO dá mais acesso a dados alheios', r.ok && linhas(r).length === 0)
  r = await as(db, { role: 'authenticated', uid: U.alice }, `update public.profiles set role = 'admin' where id = $1`, [U.alice])
  check('autopromoção continua bloqueada', negado(r))
  // Restaura o estado legítimo (a reserva foi "concluída" pelo exploit demonstrado acima).
  await db.query(`update public.reservations set status = 'pending' where id = $1`, [resBob])
  r = await as(db, { role: 'authenticated', uid: U.bob }, `update public.reservations set status = 'completed' where id = $1`, [resBob])
  check('cliente NÃO conclui a própria reserva (falha P2 corrigida)', negado(r), r.err)
  r = await as(db, { role: 'authenticated', uid: U.bob }, `update public.reservations set status = 'cancelled' where id = $1`, [resBob])
  check('...mas ainda pode CANCELAR a própria reserva pendente', r.ok && r.res.affectedRows === 1)
  r = await as(db, { role: 'anon' }, `select name from public.services`)
  check('visitante continua lendo serviços ativos', r.ok && linhas(r).length === 3)
  const pols = (await db.query(`select policyname from pg_policies where schemaname='public' and policyname in ('profiles_insert_own','reservations_update_staff_or_own_pending','services_public_read_active')`)).rows
  check('políticas inseguras do V0 foram removidas', pols.length === 0, JSON.stringify(pols))
  await db.close()
}

console.log(`\nResultado: ${total - falhas}/${total} verificações passaram`)
process.exit(falhas ? 1 : 0)
