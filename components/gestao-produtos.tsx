'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Package, Pencil, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { productErrorMessage, validateProduct, type ProductInput } from '@/lib/products/validation'

type Row = {
  id: number
  name: string
  description: string
  category: string
  tag: string
  price: number
  stock: number
  sold_count: number
  published: boolean
}

type Status = 'loading' | 'unconfigured' | 'signed-out' | 'forbidden' | 'ready' | 'error'

const EMPTY: ProductInput = { name: '', description: '', category: 'Banhos', tag: '', price: '', stock: '0', published: false }
const money = (value: number) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`

export function GestaoProdutos() {
  const [status, setStatus] = useState<Status>('loading')
  const [rows, setRows] = useState<Row[]>([])
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<{ id: number | null; form: ProductInput } | null>(null)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    let supabase
    try {
      supabase = createClient()
    } catch {
      setStatus('unconfigured')
      return
    }
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return setStatus('signed-out')
      const { data: roles, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', userData.user.id)
      if (roleError || !roles?.length) return setStatus('forbidden')
      const { data, error } = await supabase
        .from('products')
        .select('id,name,description,category,tag,price,stock,sold_count,published')
        .order('created_at', { ascending: false })
      if (error) {
        setMessage(productErrorMessage(error))
        return setStatus('error')
      }
      setRows((data ?? []) as Row[])
      setStatus('ready')
    } catch {
      setMessage('Não foi possível falar com o servidor. Verifique a conexão.')
      setStatus('error')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function run(action: () => PromiseLike<{ error: { code?: string; message?: string } | null }>, okMessage: string) {
    setBusy(true)
    setMessage('')
    try {
      const { error } = await action()
      if (error) setMessage(productErrorMessage(error))
      else { setMessage(okMessage); await load() }
    } catch {
      setMessage('Não foi possível falar com o servidor. Verifique a conexão.')
    } finally {
      setBusy(false)
    }
  }

  const togglePublished = (row: Row) => {
    if (!row.published && row.stock <= 0) return
    void run(() => createClient().from('products').update({ published: !row.published }).eq('id', row.id), row.published ? 'Produto ocultado do site.' : 'Produto publicado no site.')
  }
  const sell = (row: Row) => run(() => createClient().rpc('register_product_sale', { p_product_id: row.id, p_quantity: 1 }), `Venda registrada: ${row.name}.`)
  const remove = (row: Row) => {
    if (!window.confirm(`Excluir "${row.name}"? Esta ação não pode ser desfeita.`)) return
    void run(() => createClient().from('products').delete().eq('id', row.id), 'Produto excluído.')
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    const result = validateProduct(editing.form)
    if ('error' in result) return setFormError(result.error)
    setFormError('')
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = editing.id === null
        ? await supabase.from('products').insert(result.payload)
        : await supabase.from('products').update(result.payload).eq('id', editing.id)
      if (error) return setFormError(productErrorMessage(error))
      setEditing(null)
      setMessage(editing.id === null ? 'Produto adicionado.' : 'Produto atualizado.')
      await load()
    } catch {
      setFormError('Não foi possível falar com o servidor. Verifique a conexão.')
    } finally {
      setBusy(false)
    }
  }

  const setField = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setEditing((current) => {
      if (!current) return current
      const form = { ...current.form, [key]: value }
      if (key === 'stock' && !/^[1-9]\d*$/.test(String(value).trim())) form.published = false
      return { ...current, form }
    })

  const stockOk = editing ? /^[1-9]\d*$/.test(editing.form.stock.trim()) : false
  const totalSold = rows.reduce((sum, row) => sum + row.sold_count, 0)
  const live = rows.filter((row) => row.published && row.stock > 0).length

  return (
    <section className="management-card products-manager" id="produtos">
      <div className="card-heading">
        <div><p className="section-kicker">Estoque ritual</p><h2>Produtos</h2></div>
        {status === 'ready' && <button className="primary-button small" onClick={() => { setFormError(''); setEditing({ id: null, form: EMPTY }) }}><Plus /> Novo produto</button>}
      </div>

      {status === 'loading' && <p className="pm-note">Carregando produtos…</p>}
      {status === 'unconfigured' && <p className="pm-note">Supabase não configurado neste ambiente (faltam as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).</p>}
      {status === 'signed-out' && <p className="pm-note">Entre com uma conta da equipe para gerenciar os produtos. <Link href="/">Ir para o site e entrar</Link></p>}
      {status === 'forbidden' && <p className="pm-note">Esta conta não tem permissão de equipe. O acesso é concedido pela tabela user_roles.</p>}
      {status === 'error' && <p className="pm-note pm-error">{message}</p>}

      {status === 'ready' && <>
        <div className="pm-summary"><span><b>{rows.length}</b> produtos</span><span><b>{live}</b> no site</span><span><b>{totalSold}</b> vendas registradas</span></div>
        {message && <p className="pm-note" role="status">{message}</p>}
        {rows.length === 0 ? <p className="pm-note">Nenhum produto cadastrado ainda. Use “Novo produto”.</p> : (
          <div className="pm-table" role="table" aria-label="Produtos">
            <div className="pm-head" role="row"><span>Produto</span><span>Valor</span><span>Estoque</span><span>Vendas</span><span>No site</span><span /></div>
            {rows.map((row) => (
              <div className="pm-row" role="row" key={row.id}>
                <span className="pm-name"><strong>{row.name}</strong><small>{row.category}{row.tag ? ` · ${row.tag}` : ''}</small></span>
                <span>{money(row.price)}</span>
                <span className={row.stock === 0 ? 'pm-zero' : ''}>{row.stock}{row.stock === 0 ? ' · esgotado' : ''}</span>
                <span>{row.sold_count}</span>
                <span>
                  <button type="button" role="switch" aria-checked={row.published} aria-label={`${row.published ? 'Ocultar' : 'Publicar'} ${row.name}`} className={`pm-switch${row.published ? ' on' : ''}`} disabled={busy || (!row.published && row.stock <= 0)} title={!row.published && row.stock <= 0 ? 'Adicione estoque para poder publicar' : undefined} onClick={() => togglePublished(row)}><i /></button>
                </span>
                <span className="pm-actions">
                  <button type="button" aria-label={`Registrar venda de ${row.name}`} title="Registrar 1 venda" disabled={busy || row.stock <= 0} onClick={() => void sell(row)}><ShoppingBag /></button>
                  <button type="button" aria-label={`Editar ${row.name}`} title="Editar" disabled={busy} onClick={() => { setFormError(''); setEditing({ id: row.id, form: { name: row.name, description: row.description, category: row.category, tag: row.tag, price: String(row.price).replace('.', ','), stock: String(row.stock), published: row.published } }) }}><Pencil /></button>
                  <button type="button" aria-label={`Excluir ${row.name}`} title="Excluir" disabled={busy} onClick={() => remove(row)}><Trash2 /></button>
                </span>
              </div>
            ))}
          </div>
        )}
      </>}

      {editing && (
        <div className="pm-overlay" onClick={() => !busy && setEditing(null)}>
          <form className="pm-form" onSubmit={save} onClick={(event) => event.stopPropagation()} noValidate>
            <button type="button" className="pm-close" aria-label="Fechar" onClick={() => setEditing(null)}><X /></button>
            <p className="section-kicker"><Package /> {editing.id === null ? 'Novo produto' : 'Editar produto'}</p>
            <label>Nome<input value={editing.form.name} maxLength={120} onChange={(e) => setField('name', e.target.value)} autoFocus /></label>
            <label>Descrição<textarea value={editing.form.description} maxLength={600} rows={3} onChange={(e) => setField('description', e.target.value)} /></label>
            <div className="pm-two">
              <label>Categoria<input value={editing.form.category} maxLength={60} onChange={(e) => setField('category', e.target.value)} /></label>
              <label>Etiqueta (opcional)<input value={editing.form.tag} maxLength={30} placeholder="Novo, Mais pedido…" onChange={(e) => setField('tag', e.target.value)} /></label>
            </div>
            <div className="pm-two">
              <label>Valor (R$)<input inputMode="decimal" value={editing.form.price} placeholder="89,90" onChange={(e) => setField('price', e.target.value)} /></label>
              <label>Estoque<input inputMode="numeric" value={editing.form.stock} onChange={(e) => setField('stock', e.target.value)} /></label>
            </div>
            <label className="pm-check"><input type="checkbox" checked={editing.form.published && stockOk} disabled={!stockOk} onChange={(e) => setField('published', e.target.checked)} /> Mostrar no site {!stockOk && <small>(precisa de estoque maior que 0)</small>}</label>
            {formError && <p className="pm-note pm-error" role="alert">{formError}</p>}
            <div className="pm-buttons"><button type="button" className="outline-button" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
          </form>
        </div>
      )}
    </section>
  )
}
