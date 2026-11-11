import test from 'node:test'
import assert from 'node:assert/strict'

// Carrega o .ts removendo tipos (Node 22+ tem strip de tipos nativo via --experimental-strip-types; aqui usamos import direto).
const mod = await import('./validation.ts')
const base = { name: 'Banho de Proteção', description: '', category: '', tag: '', price: '89,90', stock: '5', published: true }

test('parsePrice aceita vírgula, ponto e R$', () => {
  assert.equal(mod.parsePrice('89,90'), 89.9)
  assert.equal(mod.parsePrice('R$ 109'), 109)
  assert.equal(mod.parsePrice('10.5'), 10.5)
  assert.equal(mod.parsePrice('-1'), null)
  assert.equal(mod.parsePrice('abc'), null)
  assert.equal(mod.parsePrice('1,234'), null)
})
test('parseStock só aceita inteiros >= 0', () => {
  assert.equal(mod.parseStock('0'), 0)
  assert.equal(mod.parseStock('12'), 12)
  assert.equal(mod.parseStock('-3'), null)
  assert.equal(mod.parseStock('1.5'), null)
  assert.equal(mod.parseStock(''), null)
})
test('não publica sem estoque', () => {
  const r = mod.validateProduct({ ...base, stock: '0' })
  assert.ok('error' in r)
  assert.ok('payload' in mod.validateProduct({ ...base, stock: '0', published: false }))
})
test('payload limpo', () => {
  const r = mod.validateProduct({ ...base, name: '  Banho   de   Amor ' })
  assert.ok('payload' in r)
  assert.equal(r.payload.name, 'Banho de Amor')
  assert.equal(r.payload.category, 'Banhos')
  assert.equal(r.payload.price, 89.9)
})
test('valida nome e tamanhos', () => {
  assert.ok('error' in mod.validateProduct({ ...base, name: 'a' }))
  assert.ok('error' in mod.validateProduct({ ...base, tag: 'x'.repeat(31) }))
  assert.ok('error' in mod.validateProduct({ ...base, price: '' }))
})
test('mensagens de erro', () => {
  assert.match(mod.productErrorMessage({ code: '42501' }), /permissão/)
  assert.match(mod.productErrorMessage({ code: '42P01' }), /migration/)
  assert.match(mod.productErrorMessage({ code: '23514', message: 'Estoque insuficiente' }), /Estoque/)
})
