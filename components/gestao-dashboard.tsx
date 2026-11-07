'use client'

import Link from 'next/link'
import { CalendarDays, ChevronRight, CircleDollarSign, Package, Plus, ShoppingBag, Sparkles, Users } from 'lucide-react'

const appointments = [
  { client: 'Marina Alves', service: 'Consulta Oracular', date: 'Hoje, 14:00', status: 'Confirmado' },
  { client: 'Rafael Costa', service: 'Ritual de Limpeza', date: 'Hoje, 16:30', status: 'Aguardando' },
  { client: 'Bianca Luz', service: 'Mapa Astral', date: '25 out, 10:00', status: 'Confirmado' },
]

const products = [
  { name: 'Banho de Proteção', stock: '18 unidades', sales: 32 },
  { name: 'Banho de Prosperidade', stock: '12 unidades', sales: 24 },
  { name: 'Banho de Amor', stock: '7 unidades', sales: 19 },
]

export function GestaoDashboard() {
  return (
    <main className="management-shell">
      <header className="management-header">
        <Link href="/" className="management-brand"><Sparkles /> Olho da Bruxa <span>gestão</span></Link>
        <div className="management-user"><div className="profile-avatar small">M</div><div><strong>Marina</strong><small>Administradora</small></div></div>
      </header>
      <div className="management-layout">
        <aside className="management-sidebar"><p className="section-kicker">Comando</p><nav><a className="selected" href="#resumo"><Sparkles /> Resumo</a><a href="#agendamentos"><CalendarDays /> Agendamentos</a><a href="#pedidos"><ShoppingBag /> Pedidos</a><a href="#produtos"><Package /> Produtos</a><a href="#clientes"><Users /> Clientes</a></nav><Link href="/" className="back-home">Voltar ao site <ChevronRight /></Link></aside>
        <section className="management-content" id="resumo">
          <div className="management-title"><div><p className="section-kicker">Terça-feira, 21 de outubro de 2026</p><h1>Boa noite, Marina.</h1><p>Aqui está o movimento da sua casa hoje.</p></div><button className="primary-button"><Plus /> Novo agendamento</button></div>
          <div className="management-stats"><article><span><CircleDollarSign /></span><small>Receita do mês</small><strong>R$ 8.420,00</strong><em>+18,4% vs. setembro</em></article><article><span><CalendarDays /></span><small>Agendamentos</small><strong>28</strong><em>6 para hoje</em></article><article><span><ShoppingBag /></span><small>Pedidos pendentes</small><strong>14</strong><em>3 aguardando envio</em></article><article><span><Users /></span><small>Novos clientes</small><strong>42</strong><em>neste mês</em></article></div>
          <div className="management-grid"><section className="management-card appointments-card" id="agendamentos"><div className="card-heading"><div><p className="section-kicker">Agenda da casa</p><h2>Próximos atendimentos</h2></div><button className="ghost-link">Ver agenda <ChevronRight /></button></div><div className="management-list">{appointments.map((appointment) => <div className="management-row" key={appointment.client}><div className="row-avatar">{appointment.client.charAt(0)}</div><div className="row-main"><strong>{appointment.client}</strong><small>{appointment.service}</small></div><div className="row-date"><strong>{appointment.date}</strong><small className={appointment.status === 'Confirmado' ? 'confirmed' : 'waiting'}>{appointment.status}</small></div><ChevronRight /></div>)}</div></section><section className="management-card" id="produtos"><div className="card-heading"><div><p className="section-kicker">Estoque ritual</p><h2>Produtos mais pedidos</h2></div><button className="icon-button" aria-label="Adicionar produto"><Plus /></button></div><div className="management-list">{products.map((product, index) => <div className="management-row product-row" key={product.name}><div className={`product-rank rank-${index + 1}`}>0{index + 1}</div><div className="row-main"><strong>{product.name}</strong><small>{product.stock}</small></div><div className="row-sales"><strong>{product.sales}</strong><small>vendas</small></div></div>)}</div></section></div>
          <section className="management-card orders-card" id="pedidos"><div className="card-heading"><div><p className="section-kicker">Operação</p><h2>Últimos pedidos</h2></div><button className="ghost-link">Ver pedidos <ChevronRight /></button></div><div className="orders-table"><div className="orders-table-head"><span>Pedido</span><span>Cliente</span><span>Valor</span><span>Status</span></div><div className="orders-table-row"><strong>#OB-1048</strong><span>Laura Mendes</span><span>R$ 198,00</span><b className="confirmed">Pago</b></div><div className="orders-table-row"><strong>#OB-1047</strong><span>Caio Nascimento</span><span>R$ 89,00</span><b className="waiting">Preparando</b></div></div></section>
        </section>
      </div>
    </main>
  )
}
