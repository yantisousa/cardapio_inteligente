import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bell, Bike, Check, ChevronRight, Clock3, CreditCard,
  LayoutDashboard, MapPin, Menu, Minus, PackageCheck, Plus, Search, Settings,
  ShoppingBag, Sparkles, Truck, Users, X,
} from 'lucide-react'
import './App.css'
import AdminApp from './AdminApp'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

const fallbackData = {
  store: {
    store_name: 'Forno & Afeto', tagline: 'Receitas artesanais, feitas para compartilhar.', primary_color: '#e85d37', accent_color: '#183c2d',
    delivery_fee_cents: 690, minimum_order_cents: 2500, estimated_delivery_minutes: 42, business_hours: { summary: 'Hoje, 18h às 23h' },
  },
  categories: [
    { id: 'cat-pizzas', name: 'Pizzas artesanais', slug: 'pizzas', products: [
      { id: 'pizza-1', name: 'Margherita da casa', description: 'Molho de tomates assados, fior di latte, manjericão e azeite.', price_cents: 4890, image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85' },
      { id: 'pizza-2', name: 'Calabresa defumada', description: 'Calabresa artesanal, cebola roxa, muçarela e orégano fresco.', price_cents: 5290, image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=85' },
      { id: 'pizza-3', name: 'Burrata & pesto', description: 'Burrata cremosa, pesto de manjericão, tomate confit e rúcula.', price_cents: 6490, image_url: 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85' },
    ] },
    { id: 'cat-entradas', name: 'Para começar', slug: 'entradas', products: [
      { id: 'entrada-1', name: 'Focaccia da casa', description: 'Massa de longa fermentação, alecrim, flor de sal e azeite.', price_cents: 2490, image_url: 'https://images.unsplash.com/photo-1593280405106-e438ebe93f5b?auto=format&fit=crop&w=900&q=85' },
      { id: 'entrada-2', name: 'Burrata ao forno', description: 'Tomatinhos confit, pesto fresco e pão tostado.', price_cents: 3590, image_url: 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=900&q=85' },
    ] },
    { id: 'cat-bebidas', name: 'Bebidas', slug: 'bebidas', products: [
      { id: 'bebida-1', name: 'Limonada siciliana', description: 'Limão siciliano, água com gás e xarope da casa. 500 ml.', price_cents: 1490, image_url: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9d?auto=format&fit=crop&w=900&q=85' },
    ] },
  ],
}

const pizzaOptions = [
  { id: 'size-medium', name: 'Média · 6 fatias', price_delta_cents: 0 },
  { id: 'size-large', name: 'Grande · 8 fatias', price_delta_cents: 1200 },
]
const extras = [
  { id: 'extra-border', name: 'Borda de catupiry', price_cents: 890 },
  { id: 'extra-cheese', name: 'Muçarela extra', price_cents: 690 },
  { id: 'extra-olive', name: 'Azeitonas', price_cents: 300 },
]

function Brand({ compact = false }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}><span className="brand-mark"><Sparkles size={18} /></span><span>Triunfo <strong>Menu</strong></span></div>
}

function ProductModal({ product, onClose, onAdd }) {
  const isPizza = product?.id?.includes('pizza') || product?.variants?.length
  const variants = product?.variants?.length ? product.variants : (isPizza ? pizzaOptions : [])
  const groups = product?.modifier_groups || (isPizza ? [{ id: 'extras', name: 'Deixe do seu jeito', options: extras, max_choices: 2 }] : [])
  const [variantId, setVariantId] = useState(variants[0]?.id || null)
  const [selectedExtras, setSelectedExtras] = useState([])
  const [quantity, setQuantity] = useState(1)

  if (!product) return null
  const variant = variants.find((item) => item.id === variantId)
  const availableExtras = groups.flatMap((group) => group.options || [])
  const total = (product.price_cents + (variant?.price_delta_cents || 0) + availableExtras.filter((item) => selectedExtras.includes(item.id)).reduce((sum, item) => sum + item.price_cents, 0)) * quantity
  const toggleExtra = (id) => setSelectedExtras((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 2 ? [...current, id] : current)

  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="product-modal">
      <button className="icon-button close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
      <div className="modal-photo" style={{ backgroundImage: `url(${product.image_url})` }} />
      <div className="modal-content">
        <span className="eyebrow">Feito no forno a lenha</span><h2>{product.name}</h2><p>{product.description}</p>
        {variants.length > 0 && <div className="option-block"><div className="option-heading"><div><strong>Escolha o tamanho</strong><small>Obrigatório</small></div><span>1 opção</span></div>
          {variants.map((item) => <label className="option-row" key={item.id}><input type="radio" name="variant" checked={variantId === item.id} onChange={() => setVariantId(item.id)} /><span>{item.name}</span><b>{item.price_delta_cents ? `+ ${money(item.price_delta_cents)}` : 'Incluso'}</b></label>)}
        </div>}
        {groups.map((group) => <div className="option-block" key={group.id}><div className="option-heading"><div><strong>{group.name}</strong><small>Opcional</small></div><span>Até {group.max_choices || 2}</span></div>
          {(group.options || []).map((item) => <label className="option-row" key={item.id}><input type="checkbox" checked={selectedExtras.includes(item.id)} onChange={() => toggleExtra(item.id)} /><span>{item.name}</span><b>+ {money(item.price_cents)}</b></label>)}
        </div>)}
        <div className="modal-footer"><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><strong>{quantity}</strong><button onClick={() => setQuantity(quantity + 1)}><Plus size={16} /></button></div><button className="primary-button grow" onClick={() => { onAdd({ product, variant, options: availableExtras.filter((item) => selectedExtras.includes(item.id)), quantity, unitPrice: total / quantity }); onClose() }}>Adicionar <span>{money(total)}</span></button></div>
      </div>
    </section>
  </div>
}

function CartDrawer({ items, store, onClose, onQuantity, onCheckout }) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  return <div className="overlay drawer-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="cart-drawer">
    <div className="drawer-header"><div><span className="eyebrow">Seu pedido</span><h2>Cesta</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
    {items.length === 0 ? <div className="empty-cart"><ShoppingBag size={40} /><h3>Sua cesta está vazia</h3><p>Escolha algo gostoso no cardápio.</p><button className="secondary-button" onClick={onClose}>Ver cardápio</button></div> : <>
      <div className="cart-items">{items.map((item, index) => <article className="cart-item" key={item.key}><img src={item.product.image_url} alt="" /><div><strong>{item.product.name}</strong><small>{item.variant?.name || 'Tamanho único'}</small>{item.options.length > 0 && <small>{item.options.map((option) => option.name).join(', ')}</small>}<b>{money(item.unitPrice)}</b></div><div className="mini-quantity"><button onClick={() => onQuantity(index, -1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => onQuantity(index, 1)}><Plus size={13} /></button></div></article>)}</div>
      <div className="cart-summary"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Entrega</span><b>{money(store.delivery_fee_cents)}</b></div><div className="total"><span>Total</span><b>{money(subtotal + store.delivery_fee_cents)}</b></div><small>Pedido mínimo de {money(store.minimum_order_cents)}</small></div>
      <button className="primary-button checkout-button" disabled={subtotal < store.minimum_order_cents} onClick={onCheckout}>Continuar pedido <ArrowRight size={18} /></button>
    </>}
  </aside></div>
}

function Checkout({ items, store, source, onBack, onSuccess }) {
  const [fulfillment, setFulfillment] = useState('delivery')
  const [payment, setPayment] = useState('pix')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const total = subtotal + (fulfillment === 'delivery' ? store.delivery_fee_cents : 0)

  async function submit(event) {
    event.preventDefault(); setSending(true); setError('')
    const form = new FormData(event.currentTarget)
    const payload = {
      customer: { name: form.get('name'), phone: form.get('phone'), email: form.get('email') || null }, fulfillment_type: fulfillment, payment_method: payment,
      delivery_address: fulfillment === 'delivery' ? { street: form.get('street'), number: form.get('number'), neighborhood: form.get('neighborhood'), city: form.get('city'), state: 'SP', postal_code: form.get('postal_code') } : null,
      notes: form.get('notes') || null,
      items: items.map((item) => ({ product_id: item.product.id, variant_id: item.variant?.id || null, modifier_option_ids: item.options.map((option) => option.id), quantity: item.quantity })),
    }
    try {
      if (source === 'api') {
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-Tenant-Host': 'demo.localhost' }, body: JSON.stringify(payload) })
        const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Não foi possível enviar o pedido.'); onSuccess(result.order)
      } else { await new Promise((resolve) => setTimeout(resolve, 900)); onSuccess({ number: 1042, public_id: crypto.randomUUID(), total_cents: total }) }
    } catch (reason) { setError(reason.message) } finally { setSending(false) }
  }

  return <main className="checkout-page"><header className="simple-header"><Brand /><button className="text-button" onClick={onBack}><ArrowLeft size={17} /> Voltar ao cardápio</button></header>
    <form className="checkout-grid" onSubmit={submit}><section className="checkout-form"><span className="eyebrow">Último passo</span><h1>Como você quer receber?</h1>
      <div className="choice-grid"><button type="button" className={fulfillment === 'delivery' ? 'choice active' : 'choice'} onClick={() => setFulfillment('delivery')}><Bike /><span><b>Entrega</b><small>Em cerca de {store.estimated_delivery_minutes} min</small></span><Check /></button><button type="button" className={fulfillment === 'pickup' ? 'choice active' : 'choice'} onClick={() => setFulfillment('pickup')}><ShoppingBag /><span><b>Retirada</b><small>Pronto em 25 min</small></span><Check /></button></div>
      <div className="form-card"><h3>Seus dados</h3><div className="field-grid"><label>Nome completo<input name="name" required placeholder="Como podemos chamar você?" /></label><label>WhatsApp<input name="phone" required placeholder="(11) 99999-9999" /></label></div><label>E-mail <small>(opcional)</small><input name="email" type="email" placeholder="voce@email.com" /></label></div>
      {fulfillment === 'delivery' && <div className="form-card"><h3>Endereço de entrega</h3><div className="field-grid wide-first"><label>Rua<input name="street" required placeholder="Rua, avenida..." /></label><label>Número<input name="number" required placeholder="123" /></label></div><div className="field-grid"><label>Bairro<input name="neighborhood" required /></label><label>Cidade<input name="city" required defaultValue="São Paulo" /></label></div><label>CEP<input name="postal_code" required placeholder="00000-000" /></label></div>}
      <div className="form-card"><h3>Pagamento direto à loja</h3><div className="payment-options"><button type="button" className={payment === 'pix' ? 'payment active' : 'payment'} onClick={() => setPayment('pix')}><span className="pix-icon">◇</span><span><b>Pix</b><small>Chave exibida após o pedido</small></span><Check /></button><button type="button" className={payment === 'card_on_delivery' ? 'payment active' : 'payment'} onClick={() => setPayment('card_on_delivery')}><CreditCard /><span><b>Cartão na entrega</b><small>Crédito ou débito</small></span><Check /></button><button type="button" className={payment === 'cash' ? 'payment active' : 'payment'} onClick={() => setPayment('cash')}><span className="cash-icon">$</span><span><b>Dinheiro</b><small>Pague ao receber</small></span><Check /></button></div></div>
      <div className="form-card"><label>Observações do pedido<textarea name="notes" rows="3" placeholder="Ex.: sem cebola, interfone não funciona..." /></label></div>
    </section><aside className="order-review"><span className="eyebrow">Resumo</span><h2>Seu pedido</h2>{items.map((item) => <div className="review-item" key={item.key}><span>{item.quantity}×</span><div><b>{item.product.name}</b><small>{item.variant?.name}</small></div><strong>{money(item.unitPrice * item.quantity)}</strong></div>)}<div className="review-totals"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>{fulfillment === 'delivery' ? 'Entrega' : 'Retirada'}</span><b>{fulfillment === 'delivery' ? money(store.delivery_fee_cents) : 'Grátis'}</b></div><div className="total"><span>Total</span><b>{money(total)}</b></div></div>{error && <p className="error-message">{error}</p>}<button className="primary-button checkout-button" disabled={sending}>{sending ? 'Enviando...' : <>Fazer pedido <span>{money(total)}</span></>}</button><small className="secure-note"><Check size={14} /> Valores conferidos novamente pelo servidor</small></aside></form>
  </main>
}

function Success({ order, onReset }) {
  return <main className="success-page"><div className="success-card"><span className="success-icon"><Check /></span><span className="eyebrow">Pedido #{order.number}</span><h1>Recebemos seu pedido!</h1><p>A cozinha já foi avisada. Você pode acompanhar cada etapa por aqui.</p><div className="timeline"><div className="done"><span /><div><b>Pedido recebido</b><small>Agora</small></div></div><div><span /><div><b>Aguardando confirmação</b><small>A loja vai revisar seu pedido</small></div></div><div><span /><div><b>Preparando com carinho</b><small>Em breve</small></div></div></div><button className="primary-button" onClick={onReset}>Voltar ao cardápio</button><small>ID do pedido: {order.public_id}</small></div></main>
}

function Storefront() {
  const [data, setData] = useState(fallbackData), [source, setSource] = useState('demo'), [search, setSearch] = useState(''), [selected, setSelected] = useState(null), [cartOpen, setCartOpen] = useState(false), [cart, setCart] = useState([]), [view, setView] = useState('menu'), [order, setOrder] = useState(null)
  useEffect(() => { fetch('/api/storefront', { headers: { 'X-Tenant-Host': 'demo.localhost' } }).then((response) => response.ok ? response.json() : Promise.reject()).then((payload) => { setData(payload); setSource('api') }).catch(() => {}) }, [])
  const products = useMemo(() => data.categories.flatMap((category) => category.products.map((product) => ({ ...product, category: category.name }))).filter((product) => `${product.name} ${product.description}`.toLowerCase().includes(search.toLowerCase())), [data, search])
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0), cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const updateQuantity = (index, delta) => setCart((current) => current.flatMap((item, itemIndex) => itemIndex !== index ? [item] : item.quantity + delta > 0 ? [{ ...item, quantity: item.quantity + delta }] : []))
  if (view === 'checkout') return <Checkout items={cart} store={data.store} source={source} onBack={() => setView('menu')} onSuccess={(created) => { setOrder(created); setView('success'); setCart([]) }} />
  if (view === 'success') return <Success order={order} onReset={() => setView('menu')} />
  return <div className="storefront" style={{ '--primary': data.store.primary_color, '--accent': data.store.accent_color }}>
    <header className="store-header"><Brand /><nav><a href="#cardapio">Cardápio</a><a href="#sobre">Nossa história</a><a href="/admin">Área da loja</a></nav><button className="cart-button" onClick={() => setCartOpen(true)}><ShoppingBag size={18} /><span>Cesta</span>{cartCount > 0 && <b>{cartCount}</b>}</button></header>
    <section className="hero-section"><div className="hero-copy"><span className="open-pill"><i /> Estamos abertos</span><h1>Comida que<br />abraça a <em>mesa.</em></h1><p>{data.store.tagline}</p><div className="hero-actions"><a className="primary-button" href="#cardapio">Ver cardápio <ArrowRight size={18} /></a><div><Clock3 size={18} /><span><b>{data.store.estimated_delivery_minutes}–55 min</b><small>Tempo de entrega</small></span></div></div></div><div className="hero-visual"><div className="arch-photo" /><div className="floating-card"><span className="avatar-stack"><i /><i /><i /></span><div><b>4,9 <span>★★★★★</span></b><small>Mais de 1.200 pedidos felizes</small></div></div><span className="handwritten">feito com afeto ↗</span></div></section>
    <section className="service-strip"><div><Truck /><span><b>Entrega cuidadosa</b><small>Do nosso forno até você</small></span></div><div><Clock3 /><span><b>Feito na hora</b><small>Nada fica esperando</small></span></div><div><MapPin /><span><b>Ingredientes locais</b><small>Escolhidos todos os dias</small></span></div></section>
    <main id="cardapio" className="menu-section"><div className="section-heading"><div><span className="eyebrow">Nosso cardápio</span><h2>Escolha seu momento favorito</h2></div><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no cardápio" /></label></div><div className="category-tabs">{data.categories.map((category, index) => <a className={index === 0 ? 'active' : ''} href={`#${category.slug}`} key={category.id}>{category.name}</a>)}</div>
      {data.categories.map((category) => { const visible = products.filter((product) => product.category === category.name); return visible.length > 0 && <section className="category-section" id={category.slug} key={category.id}><div className="category-title"><h3>{category.name}</h3><span>{visible.length} opções</span></div><div className="product-grid">{visible.map((product, index) => <article className="product-card" key={product.id} onClick={() => setSelected(product)}><div className="product-image" style={{ backgroundImage: `url(${product.image_url})` }}>{index === 0 && category.slug === 'pizzas' && <span className="favorite-badge">Mais pedido</span>}<button aria-label="Adicionar"><Plus size={20} /></button></div><div className="product-copy"><span>{product.category}</span><h4>{product.name}</h4><p>{product.description}</p><div><b>A partir de {money(product.price_cents)}</b><ChevronRight size={18} /></div></div></article>)}</div></section> })}
    </main>
    <section id="sobre" className="story-section"><div className="story-photo" /><div><span className="eyebrow">Nossa cozinha</span><h2>Tem coisas que só o tempo sabe fazer.</h2><p>Fermentação lenta, ingredientes de perto e receitas que carregam histórias. Aqui, cada pedido começa muito antes de você escolher.</p><div className="signature">Forno & Afeto <small>desde 2018</small></div></div></section>
    <footer><Brand compact /><p>Rua das Oliveiras, 184 · São Paulo, SP</p><div><span>{data.store.business_hours?.summary}</span><a href="/admin">Painel da loja</a></div></footer>
    {cartCount > 0 && <button className="mobile-cart-bar" onClick={() => setCartOpen(true)}><span><ShoppingBag size={18} /> {cartCount} {cartCount === 1 ? 'item' : 'itens'}</span><b>Ver cesta · {money(cartTotal)}</b></button>}
    {selected && <ProductModal product={selected} onClose={() => setSelected(null)} onAdd={(item) => setCart((current) => [...current, { ...item, key: crypto.randomUUID() }])} />}
    {cartOpen && <CartDrawer items={cart} store={data.store} onClose={() => setCartOpen(false)} onQuantity={updateQuantity} onCheckout={() => { setCartOpen(false); setView('checkout') }} />}
  </div>
}

const initialOrders = [
  { id: 1, number: 1042, customer: 'Ana Clara', initials: 'AC', time: '18:42', total: 7890, fulfillment: 'delivery', status: 'pending', items: ['1× Margherita grande', '1× Limonada siciliana'], note: 'Sem azeitonas' },
  { id: 2, number: 1041, customer: 'Bruno Lima', initials: 'BL', time: '18:36', total: 11870, fulfillment: 'pickup', status: 'pending', items: ['2× Calabresa média', '1× Focaccia da casa'] },
  { id: 3, number: 1040, customer: 'Camila Souza', initials: 'CS', time: '18:28', total: 7180, fulfillment: 'delivery', status: 'preparing', items: ['1× Burrata & pesto média'], note: 'Tocar interfone 24' },
  { id: 4, number: 1039, customer: 'Diego Alves', initials: 'DA', time: '18:17', total: 10580, fulfillment: 'delivery', status: 'preparing', items: ['1× Margherita grande', '1× Focaccia da casa'] },
  { id: 5, number: 1038, customer: 'Elisa Martins', initials: 'EM', time: '18:03', total: 5970, fulfillment: 'pickup', status: 'ready', items: ['1× Calabresa média'] },
]
const columns = [{ id: 'pending', title: 'Novos pedidos', tone: 'orange' }, { id: 'preparing', title: 'Em preparo', tone: 'blue' }, { id: 'ready', title: 'Prontos', tone: 'green' }]

export function AdminPanel() {
  const [orders, setOrders] = useState(initialOrders), [sidebar, setSidebar] = useState(false)
  const advance = (id, status) => setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order))
  const navItems = [{ icon: LayoutDashboard, label: 'Visão geral' }, { icon: ShoppingBag, label: 'Pedidos', active: true, badge: 2 }, { icon: Menu, label: 'Cardápio' }, { icon: Users, label: 'Clientes' }, { icon: Settings, label: 'Configurações' }]
  return <div className="admin-shell"><aside className={`admin-sidebar ${sidebar ? 'open' : ''}`}><div className="sidebar-brand"><Brand compact /><button className="icon-button sidebar-close" onClick={() => setSidebar(false)}><X /></button></div><div className="restaurant-switcher"><span>FA</span><div><b>Forno & Afeto</b><small>Loja principal</small></div><ChevronRight size={17} /></div><nav>{navItems.map(({ icon: Icon, label, active, badge }) => <button className={active ? 'active' : ''} key={label}><Icon size={19} /><span>{label}</span>{badge && <b>{badge}</b>}</button>)}</nav><div className="sidebar-bottom"><a href="/">← Ver minha loja</a><div className="admin-profile"><span>M</span><div><b>Marina Costa</b><small>Proprietária</small></div></div></div></aside>
    <main className="admin-main"><header className="admin-header"><button className="icon-button menu-toggle" onClick={() => setSidebar(true)}><Menu /></button><div><span className="eyebrow">Sexta-feira, 25 de setembro</span><h1>Boa noite, Marina!</h1></div><div className="header-actions"><span className="store-status"><i /> Loja aberta</span><button className="icon-button"><Bell size={20} /><i /></button></div></header>
      <section className="metrics"><article><span className="metric-icon orange"><ShoppingBag /></span><div><small>Pedidos hoje</small><strong>48</strong><em>+12% esta semana</em></div></article><article><span className="metric-icon green"><span>R$</span></span><div><small>Faturamento</small><strong>R$ 3.842</strong><em>+8,4% esta semana</em></div></article><article><span className="metric-icon blue"><Clock3 /></span><div><small>Tempo médio</small><strong>31 min</strong><em>4 min mais rápido</em></div></article><article><span className="metric-icon purple"><PackageCheck /></span><div><small>Ticket médio</small><strong>R$ 80,04</strong><em>+3,1% esta semana</em></div></article></section>
      <section className="orders-section"><div className="orders-heading"><div><span className="eyebrow">Operação em tempo real</span><h2>Pedidos em andamento</h2></div><div><span>Atualizado agora</span><button><Search size={17} /> Buscar pedido</button></div></div><div className="kanban">{columns.map((column) => <section className="order-column" key={column.id}><header><span className={`status-dot ${column.tone}`} /><h3>{column.title}</h3><b>{orders.filter((order) => order.status === column.id).length}</b></header><div className="order-list">{orders.filter((order) => order.status === column.id).map((order) => <article className={`order-card ${column.id === 'pending' ? 'new' : ''}`} key={order.id}><div className="order-card-head"><div><span className="order-number">#{order.number}</span><span className="order-time"><Clock3 size={13} /> {order.time}</span></div><b>{money(order.total)}</b></div><div className="customer-row"><span>{order.initials}</span><div><b>{order.customer}</b><small>{order.fulfillment === 'delivery' ? <><Bike size={13} /> Entrega</> : <><ShoppingBag size={13} /> Retirada</>}</small></div></div><div className="order-items">{order.items.map((item) => <p key={item}>{item}</p>)}</div>{order.note && <div className="order-note">“{order.note}”</div>}<div className="order-actions">{order.status === 'pending' && <><button className="ghost-danger">Recusar</button><button className="accept" onClick={() => advance(order.id, 'preparing')}>Aceitar <ChevronRight size={16} /></button></>}{order.status === 'preparing' && <button className="prepare" onClick={() => advance(order.id, 'ready')}>Marcar como pronto <PackageCheck size={16} /></button>}{order.status === 'ready' && <button className="complete" onClick={() => advance(order.id, 'completed')}>{order.fulfillment === 'delivery' ? 'Saiu para entrega' : 'Pedido retirado'} <Check size={16} /></button>}</div></article>)}{orders.filter((order) => order.status === column.id).length === 0 && <div className="empty-column"><Check /><span>Tudo em dia por aqui</span></div>}</div></section>)}</div></section>
    </main></div>
}

function App() { return window.location.pathname.startsWith('/admin') ? <AdminApp /> : <Storefront /> }
export default App
