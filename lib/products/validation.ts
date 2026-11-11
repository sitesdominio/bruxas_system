export type ProductInput = {
  name: string
  description: string
  category: string
  tag: string
  price: string
  stock: string
  published: boolean
}

export type ProductPayload = {
  name: string
  description: string
  category: string
  tag: string
  price: number
  stock: number
  published: boolean
}

/** Converte "89,90" / "89.90" em número com 2 casas; devolve null se inválido. */
export function parsePrice(raw: string): number | null {
  const text = raw.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(text)) return null
  return Math.round(Number(text.replace(',', '.')) * 100) / 100
}

export function parseStock(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d{1,6}$/.test(text)) return null
  return Number(text)
}

/** Valida o formulário. Devolve { error } em português ou { payload } pronto para gravar. */
export function validateProduct(input: ProductInput): { error: string } | { payload: ProductPayload } {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 120) return { error: 'Informe o nome do produto (2 a 120 caracteres).' }
  const description = input.description.trim()
  if (description.length > 600) return { error: 'A descrição pode ter no máximo 600 caracteres.' }
  const category = input.category.trim() || 'Banhos'
  if (category.length > 60) return { error: 'A categoria pode ter no máximo 60 caracteres.' }
  const tag = input.tag.trim()
  if (tag.length > 30) return { error: 'A etiqueta pode ter no máximo 30 caracteres.' }
  const price = parsePrice(input.price)
  if (price === null) return { error: 'Informe um valor válido, por exemplo 89,90.' }
  const stock = parseStock(input.stock)
  if (stock === null) return { error: 'Informe o estoque como número inteiro (0 ou mais).' }
  if (input.published && stock <= 0) return { error: 'Só é possível publicar o produto com estoque maior que 0.' }
  return { payload: { name, description, category, tag, price, stock, published: input.published } }
}

/** Mensagem amigável para erros do Supabase/Postgres. */
export function productErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Não foi possível concluir a operação. Tente novamente.'
  if (error.code === '42501') return 'Sem permissão. Entre com uma conta da equipe.'
  if (error.code === '42P01' || error.code === 'PGRST205') return 'A tabela de produtos ainda não existe no banco. Aplique a migration 20261110 primeiro.'
  if (error.code === '23514') {
    if (/estoque/i.test(error.message ?? '')) return 'Estoque insuficiente ou produto sem estoque para publicar.'
    return 'Os dados não passaram nas regras do banco (valor ou estoque inválidos).'
  }
  return 'Não foi possível concluir a operação. Tente novamente.'
}
