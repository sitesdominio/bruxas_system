'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StarrySky } from './starry-sky'
import { CalendarDays, ChevronRight, Menu, MessageCircle, Minus, Package, Plus, Search, ShoppingBag, Sparkles, Star, UserRound, X } from 'lucide-react'

type Product = { id: number; name: string; description: string; price: number; category: string; tag: string }

// Vitrine de demonstração: usada apenas se o banco (view products_public) não estiver disponível.
const demoProducts: Product[] = [
  { id: 1, name: 'Banho de Proteção', description: 'Ervas de alecrim, arruda e lavanda para fechar o corpo.', price: 89, category: 'Banhos', tag: 'Mais pedido' },
  { id: 2, name: 'Banho de Prosperidade', description: 'Canela, louro e manjericão para abrir caminhos.', price: 99, category: 'Banhos', tag: 'Novo' },
  { id: 3, name: 'Banho de Amor', description: 'Rosas, hibisco e baunilha para despertar o coração.', price: 109, category: 'Banhos', tag: 'Ritual' },
]

const services = [
  { name: 'Consulta Oracular', detail: 'Tarô, acolhimento e direcionamento', time: '50 min', price: 'R$ 180' },
  { name: 'Ritual de Limpeza', detail: 'Atendimento energético individual', time: '60 min', price: 'R$ 220' },
  { name: 'Mapa Astral', detail: 'Leitura profunda do seu céu', time: '90 min', price: 'R$ 280' },
]

export function OlhoDaBruxa({ catalogOnly = false }: { catalogOnly?: boolean }) {
  const [cart, setCart] = useState<number[]>([])
  const crossRef = useRef<HTMLDivElement>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'demo'>('loading')

  // Vitrine: só produtos publicados e com estoque (view products_public). Se o banco não responder, usa a demonstração.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data, error } = await createClient().from('products_public').select('id,name,description,category,tag,price').order('id')
        if (!active) return
        if (error) throw error
        setProducts((data ?? []).map((item) => ({ ...item, price: Number(item.price) })) as Product[])
        setCatalogState('ready')
      } catch {
        if (!active) return
        setProducts(demoProducts)
        setCatalogState('demo')
      }
    })()
    return () => { active = false }
  }, [])

  // Efeito 3D da cruz: inclina/gira conforme a rolagem (e levemente com o mouse). Respeita prefers-reduced-motion.
  useEffect(() => {
    const el = crossRef.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let pointerX = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      const ry = Math.sin(y / 240) * 32 + pointerX * 8
      const rx = Math.min(y / 28, 16) - 4
      el.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
      el.style.setProperty('--ty', `${(-Math.min(y, 600) * 0.06).toFixed(1)}px`)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const onPointer = (event: PointerEvent) => { pointerX = (event.clientX / window.innerWidth - 0.5) * 2; schedule() }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('pointermove', onPointer, { passive: true })
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('pointermove', onPointer); if (frame) cancelAnimationFrame(frame) }
  }, [])

  const [showCart, setShowCart] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState('24')
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const cartItems = useMemo(() => products.filter((product) => cart.includes(product.id)), [cart, products])
  const visibleProducts = useMemo(() => products.filter((product) => `${product.name} ${product.description}`.toLowerCase().includes(searchTerm.trim().toLowerCase())), [searchTerm, products])
  const total = cartItems.reduce((sum, item) => sum + item.price, 0)

  function go(tab: 'inicio' | 'banhos' | 'agenda') {
    setMobileMenu(false)
    document.getElementById(tab === 'inicio' ? 'rituais' : tab) ?.scrollIntoView({ behavior: 'smooth' })
  }

  function addToCart(product: Product) {
    if (!cart.includes(product.id)) setCart([...cart, product.id])
    setNotice(`${product.name} foi para o seu círculo.`)
    setTimeout(() => setNotice(''), 2500)
  }

  async function book(service: string) {
    const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceName: service, customerName: 'Cliente da conta', customerPhone: 'A confirmar', scheduledAt: `2026-10-${selectedDate}T14:00:00-03:00` }) })
    const result = await response.json()
    setNotice(response.ok ? `${service} reservado com sucesso.` : result.error || 'Não foi possível reservar.')
    setTimeout(() => setNotice(''), 3500)
  }

  async function signIn() {
    setAuthError('')
    setAuthLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setAuthLoading(false)
    if (error) return setAuthError('Email ou senha inválidos.')
    setShowLogin(false)
    setShowProfile(true)
  }

  async function signUp() {
    setAuthError('')
    setAuthLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
        data: { full_name: fullName },
      },
    })
    setAuthLoading(false)
    if (error) return setAuthError(error.message.includes('already') ? 'Não foi possível criar esta conta.' : 'Verifique os dados e tente novamente.')
    setAuthError('Conta criada. Verifique seu email para confirmar o acesso.')
  }

  async function requestPasswordReset() {
    setAuthError('')
    setAuthLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    })
    setAuthLoading(false)
    setAuthError('Se este email estiver cadastrado, enviaremos as instruções de recuperação.')
  }

  function switchAuthMode(mode: 'login' | 'signup' | 'forgot') {
    setAuthMode(mode)
    setAuthError('')
  }

  return (
    <main className="site-shell">
      <div className="stars stars-one" /><div className="stars stars-two" /><div className="moon-glow" />
      <StarrySky />
      <header className="site-header">
        <button className="mobile-trigger" aria-label="Abrir menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
        <Link className="brand" href="/"><Image className="brand-logo header-logo" src="/logo-anubis-olho.png" alt="Olho da Bruxa" width={122} height={58} priority /><span className="sr-only">Olho da Bruxa</span></Link>
        <nav className={mobileMenu ? 'main-nav open' : 'main-nav'} aria-label="Navegação principal">
          <Link className={!catalogOnly ? 'active' : ''} href="/">Início</Link>
          <Link className={catalogOnly ? 'active' : ''} href="/banhos">Banhos</Link>
          <Link href="/#agenda" onClick={() => setMobileMenu(false)}>Agendar</Link>
          <button className="nav-account" onClick={() => { setShowLogin(true); setMobileMenu(false) }}>Minha conta</button>
        </nav>
        <label className="product-search"><Search aria-hidden="true" /><input type="search" aria-label="Buscar produtos" placeholder="Buscar produtos" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />{searchTerm && <button type="button" aria-label="Limpar busca" onClick={() => setSearchTerm('')}><X /></button>}</label>
        <div className="header-actions"><button aria-label="Minha conta" onClick={() => setShowLogin(true)}><UserRound /></button><button className="cart-button" aria-label="Abrir carrinho" onClick={() => setShowCart(true)}><ShoppingBag /><span>{cart.length}</span></button></div>
      </header>

      {!catalogOnly && <section className="hero" id="inicio">
        <div className="hero-copy"><p className="eyebrow"><Sparkles /> Banhos e atendimentos espirituais</p><h1>O que está embaixo<br /><em>é como o que está em cima.</em></h1><p className="hero-text">Banhos rituais feitos à mão e atendimentos individuais, com intenção em cada detalhe.</p><div className="hero-actions"><Link className="primary-button" href="/banhos">Conheça os banhos <ChevronRight /></Link><Link className="ghost-button" href="/#agenda">Agendar horário <CalendarDays /></Link></div></div>
        <div className="hero-symbol" aria-hidden="true"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="hero-stage"><div className="hero-logo-frame" ref={crossRef}><Image className="cross-depth" src="/logo-anubis-olho.png" alt="" width={420} height={420} /><Image className="cross-face" src="/logo-anubis-olho.png" alt="" width={420} height={420} priority /></div></div></div>
      </section>}

      <section className={`products-section ${catalogOnly ? 'catalog-page' : 'home-products'}`} id="banhos"><div className="section-heading"><div>{catalogOnly && <p className="section-kicker">Feitos à mão · enviados com intenção</p>}<h2>{catalogOnly ? <>Todos os <em>produtos</em></> : <>Banhos <em>rituais</em></>}</h2></div>{catalogOnly ? <div className="catalog-actions"><Link className="outline-button" href="/">Voltar ao início</Link><Link className="primary-button" href="/#agenda">Agendar horário <CalendarDays /></Link></div> : <Link className="outline-button" href="/banhos">Ver todos <ChevronRight /></Link>}</div>{visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product, index) => <article className="product-card" key={product.id}><div className={`product-art art-${index % 3}`}><span>{product.tag}</span><div className="botanical" /></div><div className="product-info"><div><h3>{product.name}</h3><p>{product.description}</p></div><strong>R$ {product.price.toFixed(2).replace('.', ',')}</strong></div><button className="add-button" onClick={() => addToCart(product)}>Adicionar ao carrinho <Plus /></button></article>)}</div> : <p className="search-empty">{catalogState === 'loading' ? 'Carregando produtos…' : searchTerm.trim() ? <>Nenhum produto encontrado para “{searchTerm}”.</> : 'Novos produtos chegando em breve.'}</p>}</section>

      {!catalogOnly && <section className="intro-section" id="rituais"><div><p className="section-kicker">A casa</p><h2>Entre, a noite<br /><em>é sua.</em></h2></div><p className="intro-copy">Na Olho da Bruxa, cada mistura é preparada com intenção. Escolha um banho, marque um encontro ou simplesmente respire. O seu tempo também é sagrado.</p></section>}

      {!catalogOnly && <section className="appointment-section" id="agenda"><div className="appointment-copy"><p className="section-kicker">Atendimentos individuais</p><h2>Seu ritual<br /><em>começa aqui.</em></h2><p>Escolha um serviço e encontre um horário que respeite o seu momento. Um atendimento por vez, com presença inteira.</p><button className="primary-button" onClick={() => setShowLogin(true)}>Entrar para agendar <CalendarDays /></button></div><div className="booking-card"><div className="booking-top"><div><p className="mini-label">Outubro 2026</p><h3>Escolha um dia</h3></div><CalendarDays /></div><div className="dates">{['22','23','24','25','26'].map((date, i) => <button key={date} className={selectedDate === date ? 'selected' : ''} onClick={() => setSelectedDate(date)}><small>{['QUI','SEX','SÁB','DOM','SEG'][i]}</small><b>{date}</b></button>)}</div><div className="service-list">{services.map((service) => <button key={service.name} className="service-row" onClick={() => book(service.name)}><span><b>{service.name}</b><small>{service.detail} · {service.time}</small></span><strong>{service.price}</strong><ChevronRight /></button>)}</div></div></section>}

      <footer className="site-footer"><div className="footer-symbols" aria-label="Símbolos astrológicos e alquímicos" aria-hidden="true"><span>☽</span><span>✦</span><span>☿</span><span>♄</span><span>♃</span><span>♀</span><span>♂</span></div><div className="brand footer-brand"><Image className="brand-logo footer-logo" src="/logo-anubis-olho.png" alt="Olho da Bruxa" width={122} height={58} /><span className="sr-only">Olho da Bruxa</span></div><p>O que está em cima é como o que está embaixo.</p><div className="footer-links"><a href="https://instagram.com" target="_blank" rel="noreferrer"><Star /> Instagram</a><a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a><Link href="/gestao"><Sparkles /> Gestão</Link></div></footer>

      <a className="whatsapp" href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" aria-label="Falar pelo WhatsApp"><MessageCircle /></a>
      {notice && <div className="toast"><Sparkles /> {notice}</div>}

      {showCart && <div className="overlay" onClick={() => setShowCart(false)}><aside className="side-panel" onClick={(event) => event.stopPropagation()}><button className="close-panel" onClick={() => setShowCart(false)}><X /></button><p className="section-kicker">Seu círculo</p><h2>Meu carrinho</h2>{cartItems.length ? <>{cartItems.map((item) => <div className="cart-item" key={item.id}><div><b>{item.name}</b><small>1 unidade</small></div><strong>R$ {item.price.toFixed(2).replace('.', ',')}</strong><button onClick={() => setCart(cart.filter((id) => id !== item.id))}><Minus /></button></div>)}<div className="cart-total"><span>Total dos produtos</span><strong>R$ {total.toFixed(2).replace('.', ',')}</strong></div><label className="delivery-label">Entrega ou retirada<select><option>Retirar no local — grátis</option><option>Calcular entrega pelo CEP</option></select></label><button className="primary-button full" onClick={() => setShowLogin(true)}>Finalizar compra <ChevronRight /></button><p className="secure-note">Você será direcionado ao Checkout Pro do Mercado Pago.</p></> : <div className="empty-cart"><ShoppingBag /><p>Seu círculo ainda está vazio.</p><button className="outline-button" onClick={() => { setShowCart(false); go('banhos') }}>Ver banhos</button></div>}</aside></div>}
      {showLogin && <div className="overlay" onClick={() => setShowLogin(false)}><div className="auth-modal" onClick={(event) => event.stopPropagation()}><button className="close-panel" onClick={() => setShowLogin(false)}><X /></button><p className="section-kicker">Acesso reservado</p><h2>{authMode === 'login' ? 'Bem-vinda de volta.' : authMode === 'signup' ? 'Crie seu círculo.' : 'Recupere seu acesso.'}</h2><p>{authMode === 'login' ? 'Entre na sua conta para acompanhar pedidos e agendar seus rituais.' : authMode === 'signup' ? 'Cadastre-se para acompanhar reservas, pedidos e novidades.' : 'Informe seu email e enviaremos um link seguro de recuperação, caso ele esteja cadastrado.'}</p>{authMode === 'signup' && <label>Nome completo<input type="text" placeholder="Seu nome" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}<label>Email<input type="email" placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{authMode !== 'forgot' && <label>Senha<input type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}{authError && <p className="form-error" role="alert">{authError}</p>}{authMode === 'login' ? <button className="primary-button full" onClick={signIn} disabled={authLoading}>Entrar <ChevronRight /></button> : authMode === 'signup' ? <button className="primary-button full" onClick={signUp} disabled={authLoading}>Criar conta <ChevronRight /></button> : <button className="primary-button full" onClick={requestPasswordReset} disabled={authLoading}>Enviar recuperação <ChevronRight /></button>}{authMode !== 'login' && <button className="text-button centered" onClick={() => switchAuthMode('login')}>Voltar para entrar</button>}{authMode === 'login' && <><button className="text-button centered" onClick={() => switchAuthMode('signup')}>Criar uma conta</button><button className="text-button centered" onClick={() => switchAuthMode('forgot')}>Esqueci minha senha</button></>}</div></div>}
      {showProfile && <div className="overlay" onClick={() => setShowProfile(false)}><div className="auth-modal profile-modal" onClick={(event) => event.stopPropagation()}><button className="close-panel" onClick={() => setShowProfile(false)}><X /></button><div className="profile-avatar">M</div><p className="section-kicker">Meu perfil</p><h2>Olá, Marina.</h2><div className="profile-links"><button><Package /> Minhas compras <ChevronRight /></button><button><CalendarDays /> Meus agendamentos <ChevronRight /></button><button><UserRound /> Dados pessoais <ChevronRight /></button></div></div></div>}
    </main>
  )
}
