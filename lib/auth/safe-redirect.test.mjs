// Executar com: pnpm test   (Node 22.18+ ou 24, que lê TypeScript sem configuração extra)
import test from 'node:test'
import assert from 'node:assert/strict'
import { safeNextPath } from './safe-redirect.ts'

test('aceita caminhos relativos do próprio site', () => {
  assert.equal(safeNextPath('/'), '/')
  assert.equal(safeNextPath('/redefinir-senha'), '/redefinir-senha')
  assert.equal(safeNextPath('/gestao?aba=1#topo'), '/gestao?aba=1#topo')
})

test('usa o fallback quando não há valor', () => {
  assert.equal(safeNextPath(null), '/')
  assert.equal(safeNextPath(undefined, '/redefinir-senha'), '/redefinir-senha')
  assert.equal(safeNextPath(''), '/')
})

test('bloqueia redirecionamento para sites externos', () => {
  const ataques = [
    'https://evil.com',
    'http://evil.com/x',
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    '/\\/evil.com',
    'javascript:alert(1)',
    'evil.com',
    '/%0d%0aSet-Cookie:x=1'.replace('%0d%0a', '\r\n'),
    '/\tfoo',
    'data:text/html,x',
    ' //evil.com',
    '@evil.com',
  ]
  for (const ataque of ataques) assert.equal(safeNextPath(ataque), '/', `deveria bloquear: ${JSON.stringify(ataque)}`)
})

test('o resultado nunca muda de origem', () => {
  for (const entrada of ['/a/../..//evil.com', '/..//evil.com', '/a/..//evil.com', '/%2F%2Fevil.com']) {
    const saida = safeNextPath(entrada)
    assert.equal(new URL(saida, 'https://loja.example').origin, 'https://loja.example', entrada)
  }
})
