import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bell, BellOff, Check, ChevronRight, Clock3, Eye, EyeOff, GripVertical, Image, LayoutDashboard, LayoutTemplate, LockKeyhole, LogOut, Mail, MapPin, Menu, Monitor, PackageCheck,
  MessageCircle, PackageX, Palette, Pencil, Phone, Plus, Power, Printer, ReceiptText, RotateCcw, Save, Search, Settings, ShoppingBag,
  ShieldCheck, Smartphone, Sparkles, Store, Trash2, Upload, Users, X,
} from 'lucide-react'
import { tenantHeaders, tenantStorageKey, tenantUrl } from './tenant'
import { DEFAULT_DESIGN, mergeDesign } from './storefrontDesign'
import { TriunfoLogo, TriunfoMark } from './TriunfoBrand'
import './AdminBrand.css'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
const toCents = (value) => Math.round(Number(String(value || 0).replace(',', '.')) * 100)
const fromCents = (value) => ((value || 0) / 100).toFixed(2).replace('.', ',')
const tokenStorageKey = tenantStorageKey('admin_token')
const userStorageKey = tenantStorageKey('admin_user')
const orderStatuses = [
  ['pending', 'Pendente'],
  ['accepted', 'Aceito'],
  ['preparing', 'Em preparo'],
  ['ready', 'Pronto'],
  ['out_for_delivery', 'Saiu para entrega'],
  ['completed', 'Concluído'],
  ['cancelled', 'Cancelado'],
]
const orderStatusLabel = (status) => orderStatuses.find(([value]) => value === status)?.[1] || status
const dateTime = (value) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sem pedidos'
const paymentLabels = { pix: 'Pix', cash: 'Dinheiro', card_on_delivery: 'Cartão na entrega' }
const paymentStatusLabels = { pending: 'Aguardando pagamento', paid: 'Pago', failed: 'Recusado', expired: 'Expirado' }
const paymentStatuses = [['pending', 'Aguardando pagamento'], ['paid', 'Pago'], ['failed', 'Recusado'], ['expired', 'Expirado']]
const fulfillmentLabels = { delivery: 'Entrega', pickup: 'Retirada na loja' }
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character])
const contactPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '')
  return digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
}
const addressLine = (address) => address ? [
  [address.street, address.number].filter(Boolean).join(', '),
  address.complement,
  address.neighborhood,
  [address.city, address.state].filter(Boolean).join('/'),
  address.postal_code ? `CEP ${address.postal_code}` : '',
].filter(Boolean).join(' · ') : ''
const scheduleDays = [
  ['monday', 'Segunda'], ['tuesday', 'Terça'], ['wednesday', 'Quarta'], ['thursday', 'Quinta'],
  ['friday', 'Sexta'], ['saturday', 'Sábado'], ['sunday', 'Domingo'],
]
const emptySchedule = () => Object.fromEntries(scheduleDays.map(([day]) => [day, []]))

const normalizeSettings = (settings) => ({
  ...settings,
  delivery_fee: fromCents(settings.delivery_fee_cents),
  delivery_zones: (settings.delivery_zones || []).map((zone) => ({ ...zone, fee: fromCents(zone.fee_cents) })),
  minimum_order: fromCents(settings.minimum_order_cents),
  address: settings.address || {},
  business_hours: {
    summary: settings.business_hours?.summary || '',
    timezone: settings.business_hours?.timezone || 'America/Sao_Paulo',
    schedule: { ...emptySchedule(), ...(settings.business_hours?.schedule || {}) },
  },
  storefront_content: settings.storefront_content || {},
  storefront_design: mergeDesign(settings.storefront_design),
})

async function api(path, { token, method = 'GET', body, formData } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { Accept: 'application/json', ...tenantHeaders, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData || (body ? JSON.stringify(body) : undefined),
  })
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('admin-unauthorized'))
    const validation = data?.errors ? Object.values(data.errors).flat()[0] : null
    const message = response.status === 401 ? 'Sua sessão expirou. Faça login novamente.' : (validation || data?.message || 'Não foi possível concluir esta ação.')
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return data
}

function BrandAssetUpload({ kind, label, value, uploading, onUpload }) {
  const inputId = `brand-${kind}-upload`
  return <div className={`brand-asset-field ${kind}`}><div className="brand-asset-preview">{value ? <img src={value} alt={`Prévia de ${label.toLowerCase()}`} /> : <Image />}</div><div className="brand-asset-copy"><b>{label}</b><small>{kind === 'logo' ? 'PNG, JPG ou WebP. Recomendado: imagem quadrada.' : 'PNG, JPG ou WebP. Recomendado: formato horizontal.'}</small><label className={`asset-upload-button ${uploading === kind ? 'disabled' : ''}`} htmlFor={inputId}><Upload /> {uploading === kind ? 'Enviando...' : `Enviar ${label.toLowerCase()}`}</label><input id={inputId} className="asset-file-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(kind, file); event.target.value = '' }} /></div></div>
}

function AdminBrand() {
  return <a className="admin-platform-brand" href="/triunfo-menu" aria-label="Conhecer a Triunfo Menu"><TriunfoLogo /></a>
}

function AdminLogin({ onLogin, store }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event) {
    event.preventDefault(); setSending(true); setError('')
    try {
      const data = await api('/admin/login', { method: 'POST', body: { email, password } })
      onLogin(data)
    } catch (reason) { setError(reason.message) } finally { setSending(false) }
  }

  return <main className="admin-login platform-login">
    <section className="platform-login-story" aria-labelledby="platform-login-title">
      <a className="platform-login-wordmark" href="/triunfo-menu" aria-label="Conhecer a Triunfo Menu"><TriunfoMark /><span>Triunfo Menu<small>TECNOLOGIA QUE SERVE O SEU NEGÓCIO</small></span></a>
      <div className="platform-login-pitch">
        <span className="platform-login-eyebrow">O PRÓXIMO CAPÍTULO DO SEU NEGÓCIO</span>
        <h1 id="platform-login-title">Mais controle.<br />Mais tempo.<br /><span>Mais triunfo.</span></h1>
        <p>Seu cardápio, sua equipe e cada pedido.<br />Tudo no lugar certo para você ir além.</p>
        <ul className="platform-login-features">
          <li><ReceiptText /><span><b>Uma operação organizada</b><small>Acompanhe os pedidos em um só painel.</small></span></li>
          <li><Palette /><span><b>Uma loja com a sua cara</b><small>Personalize seu cardápio sem complicação.</small></span></li>
          <li><Users /><span><b>Sua equipe conectada</b><small>Cada pessoa com seu acesso à loja.</small></span></li>
        </ul>
      </div>
      <span className="platform-login-signature">Feito para quem coloca sabor no mundo.</span>
    </section>

    <section className="platform-login-content" aria-labelledby="platform-login-form-title">
      <div className="platform-login-card">
        <AdminBrand />
        <span className="platform-login-eyebrow">BEM-VINDO DE VOLTA</span>
        <h2 id="platform-login-form-title">Entrar no painel</h2>
        <p>Seu próximo triunfo começa por aqui.</p>
        {store?.store_name && <div className="platform-login-store">
          {store.logo_url ? <img src={store.logo_url} alt={`Logo de ${store.store_name}`} /> : <Store aria-hidden="true" />}
          <span><small>VOCÊ ESTÁ ACESSANDO</small><strong>{store.store_name}</strong></span>
        </div>}
        <form className="platform-login-form" onSubmit={submit} aria-busy={sending}>
          <label htmlFor="admin-email">E-mail da equipe</label>
          <div className="platform-login-field"><Mail aria-hidden="true" /><input id="admin-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@seurestaurante.com.br" disabled={sending} required /></div>
          <label htmlFor="admin-password">Senha</label>
          <div className="platform-login-field"><LockKeyhole aria-hidden="true" /><input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Sua senha" disabled={sending} /><button className="platform-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} aria-controls="admin-password">{showPassword ? <EyeOff /> : <Eye />}</button></div>
          {error && <div className="admin-alert error" role="alert">{error}</div>}
          <button className="platform-login-submit" type="submit" disabled={sending}>{sending ? 'Entrando...' : 'Entrar no painel'}<ArrowRight size={18} aria-hidden="true" /></button>
          <p className="platform-login-help">Use o acesso fornecido pelo responsável da sua loja.</p>
        </form>
        <a className="platform-login-back" href={tenantUrl('/')}><ArrowLeft size={15} /> Voltar para o cardápio</a>
        <div className="platform-login-footer"><ShieldCheck size={15} /><span>Área exclusiva da equipe · Triunfo Menu</span></div>
      </div>
    </section>
  </main>
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="admin-empty"><Icon /><h3>{title}</h3><p>{text}</p></div>
}

function OrderDetails({ order, store, updating, updatingPayment, error, onClose, onStatusChange, onPaymentChange }) {
  const customer = order.customer_snapshot || {}
  const address = order.delivery_address_snapshot
  const phone = contactPhone(customer.phone)
  const whatsappMessage = encodeURIComponent(`Olá, ${customer.name || 'cliente'}! Estamos entrando em contato sobre o pedido #${order.number}.`)

  function printOrder() {
    const items = (order.items || []).map((item) => {
      const details = [item.variant_name, ...(item.modifiers || []).map((modifier) => modifier.option_name)].filter(Boolean)
      return `<div class="item"><div><b>${escapeHtml(item.quantity)}× ${escapeHtml(item.product_name)}</b>${details.length ? `<small>${escapeHtml(details.join(' · '))}</small>` : ''}${item.notes ? `<small>Obs.: ${escapeHtml(item.notes)}</small>` : ''}</div><strong>${escapeHtml(money(item.total_cents))}</strong></div>`
    }).join('')
    const printWindow = window.open('', '_blank', 'width=460,height=760')
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido #${escapeHtml(order.number)}</title><style>*{box-sizing:border-box}body{color:#111;font:12px Arial,sans-serif;margin:0;padding:20px;width:80mm}h1{font-size:20px;margin:0;text-align:center}h2{border-bottom:1px dashed #777;font-size:13px;margin:18px 0 8px;padding-bottom:5px}.center{text-align:center}.muted{color:#555;font-size:10px}.item,.total{display:flex;gap:10px;justify-content:space-between;padding:6px 0}.item{border-bottom:1px dotted #aaa}.item div{display:flex;flex-direction:column}.item small{color:#555;margin-top:2px}.summary{border-top:1px dashed #555;margin-top:12px;padding-top:6px}.summary div{display:flex;justify-content:space-between;padding:3px 0}.total{border-top:1px solid #111;font-size:15px;margin-top:5px}.note{border:1px solid #777;margin-top:12px;padding:8px;white-space:pre-wrap}@media print{body{padding:0}}</style></head><body><h1>${escapeHtml(store?.store_name || 'Comanda')}</h1><p class="center"><b>Pedido #${escapeHtml(order.number)}</b><br><span class="muted">${escapeHtml(dateTime(order.placed_at))}</span></p><h2>Cliente</h2><b>${escapeHtml(customer.name || '')}</b><br>${escapeHtml(customer.phone || '')}${customer.email ? `<br>${escapeHtml(customer.email)}` : ''}<h2>Atendimento</h2>${escapeHtml(fulfillmentLabels[order.fulfillment_type] || order.fulfillment_type)} · ${escapeHtml(paymentLabels[order.payment_method] || order.payment_method)} · ${escapeHtml(paymentStatusLabels[order.payment_status] || order.payment_status)}${address ? `<br><span class="muted">${escapeHtml(addressLine(address))}</span>` : ''}<h2>Itens</h2>${items}<div class="summary"><div><span>Subtotal</span><b>${escapeHtml(money(order.subtotal_cents))}</b></div>${order.delivery_fee_cents ? `<div><span>Entrega</span><b>${escapeHtml(money(order.delivery_fee_cents))}</b></div>` : ''}${order.discount_cents ? `<div><span>Desconto</span><b>− ${escapeHtml(money(order.discount_cents))}</b></div>` : ''}<div class="total"><span>Total</span><b>${escapeHtml(money(order.total_cents))}</b></div></div>${order.notes ? `<div class="note"><b>Observações:</b><br>${escapeHtml(order.notes)}</div>` : ''}<p class="center muted">Status: ${escapeHtml(orderStatusLabel(order.status))}</p></body></html>`)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 250)
  }

  return <div className="overlay"><section className="admin-modal order-detail-modal"><header><div><span className="eyebrow">Detalhes do pedido</span><h2>Pedido #{order.number}</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></header><div className="admin-modal-body order-detail-body">{error && <div className="admin-alert error order-detail-error">{error}</div>}{order.scheduled_for && <div className="order-scheduled-notice"><Clock3 /><div><b>Pedido agendado</b><span>Preparar a partir de {dateTime(order.scheduled_for)}</span></div></div>}<div className="order-detail-toolbar"><div><span>{dateTime(order.placed_at)}</span><label className={`order-status-control ${order.status}`}><select aria-label={`Status do pedido ${order.number}`} value={order.status} disabled={updating} onChange={(event) => onStatusChange(order, event.target.value)}>{orderStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><div>{customer.phone && <><a className="order-action-button" href={`tel:+${phone}`}><Phone /> Ligar</a><a className="order-action-button whatsapp" href={`https://wa.me/${phone}?text=${whatsappMessage}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></>}<button type="button" className="order-action-button print" onClick={printOrder}><Printer /> Imprimir comanda</button></div></div><div className="order-detail-grid"><div className="order-detail-main"><section className="admin-form-card"><div className="order-section-title"><ReceiptText /><div><h3>Itens do pedido</h3><p>{order.items?.length || 0} item(ns)</p></div></div><div className="order-detail-items">{(order.items || []).map((item) => <article key={item.id}><span>{item.quantity}×</span><div><b>{item.product_name}</b>{item.variant_name && <small>{item.variant_name}</small>}{item.modifiers?.map((modifier) => <small key={modifier.id}>{modifier.group_name}: {modifier.option_name}{modifier.price_cents ? ` (+${money(modifier.price_cents)})` : ''}</small>)}{item.notes && <em>Obs.: {item.notes}</em>}</div><strong>{money(item.total_cents)}</strong></article>)}</div>{order.notes && <div className="order-general-note"><b>Observações do pedido</b><p>{order.notes}</p></div>}<div className="order-detail-totals"><div><span>Subtotal</span><b>{money(order.subtotal_cents)}</b></div>{order.delivery_fee_cents > 0 && <div><span>Taxa de entrega</span><b>{money(order.delivery_fee_cents)}</b></div>}{order.discount_cents > 0 && <div><span>Desconto</span><b>− {money(order.discount_cents)}</b></div>}<div className="total"><span>Total</span><strong>{money(order.total_cents)}</strong></div></div></section></div><aside className="order-detail-side"><section className="admin-form-card"><div className="order-section-title"><Users /><div><h3>Cliente</h3><p>Contato do pedido</p></div></div><div className="order-info-list"><div><small>Nome</small><b>{customer.name || 'Não informado'}</b></div><div><small>Telefone</small><b>{customer.phone || 'Não informado'}</b></div>{customer.email && <div><small>E-mail</small><b>{customer.email}</b></div>}</div></section><section className="admin-form-card"><div className="order-section-title"><MapPin /><div><h3>{order.fulfillment_type === 'delivery' ? 'Entrega' : 'Retirada'}</h3><p>{fulfillmentLabels[order.fulfillment_type] || order.fulfillment_type}</p></div></div>{address ? <div className="order-address"><b>{address.label || 'Endereço'}</b><span>{addressLine(address)}</span>{address.reference && <small>Referência: {address.reference}</small>}</div> : <p className="muted-help">O cliente retirará o pedido na loja.</p>}</section><section className={`admin-form-card payment-management ${order.payment_status}`}><div className="order-section-title"><ShoppingBag /><div><h3>Pagamento</h3><p>{paymentLabels[order.payment_method] || order.payment_method}</p></div></div><div className="payment-status-heading"><span>{paymentStatusLabels[order.payment_status] || order.payment_status}</span>{order.payment_method === 'pix' && order.payment_status !== 'paid' && <small>Confirme o Pix antes de iniciar a produção.</small>}</div>{order.payment_method === 'pix' && order.payment_status !== 'paid' && <button type="button" className="confirm-payment-button" disabled={updatingPayment} onClick={() => onPaymentChange(order, 'paid')}><Check /> {updatingPayment ? 'Confirmando...' : 'Confirmar Pix recebido'}</button>}<label className="payment-status-select">Alterar situação<select value={order.payment_status} disabled={updatingPayment} onChange={(event) => onPaymentChange(order, event.target.value)}>{paymentStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></section></aside></div></div></section></div>
}

function OrdersView({ token, store }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState('')
  const [updatingPaymentId, setUpdatingPaymentId] = useState('')
  const [error, setError] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(tenantStorageKey('order_bell')) !== 'off')
  const [soundReady, setSoundReady] = useState(false)
  const [newOrderIds, setNewOrderIds] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const knownOrderIds = useRef(new Set())
  const initialized = useRef(false)
  const requestRunning = useRef(false)
  const audioContext = useRef(null)
  const highlightTimer = useRef(null)
  const voiceTimer = useRef(null)

  const playBell = useCallback(async (force = false) => {
    if (!soundEnabled && !force) return false
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return false

    try {
      if (!audioContext.current) audioContext.current = new AudioContext()
      if (audioContext.current.state === 'suspended') await audioContext.current.resume()
      const context = audioContext.current
      const start = context.currentTime
      ;[880, 1320].forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, start)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.24 : 0.12, start + 0.025)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.15)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(start)
        oscillator.stop(start + 1.2)
      })
      setSoundReady(true)
      return true
    } catch {
      setSoundReady(false)
      return false
    }
  }, [soundEnabled])

  const speakNewOrder = useCallback(() => {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return

    window.clearTimeout(voiceTimer.current)
    window.speechSynthesis.cancel()
    voiceTimer.current = window.setTimeout(() => {
      const message = new window.SpeechSynthesisUtterance('Novo pedido')
      const voices = window.speechSynthesis.getVoices()
      message.voice = voices.find((voice) => voice.lang.toLowerCase() === 'pt-br')
        || voices.find((voice) => voice.lang.toLowerCase().startsWith('pt'))
        || null
      message.lang = 'pt-BR'
      message.rate = 0.92
      message.pitch = 1.05
      message.volume = 1
      window.speechSynthesis.speak(message)
    }, 420)
  }, [])

  const announceNewOrder = useCallback(async (force = false) => {
    if (!soundEnabled && !force) return
    await playBell(force)
    speakNewOrder()
  }, [playBell, soundEnabled, speakNewOrder])

  const loadOrders = useCallback(async (notify = true) => {
    if (requestRunning.current) return
    requestRunning.current = true
    try {
      const data = await api('/admin/orders', { token })
      const incoming = data.orders || []
      if (initialized.current && notify) {
        const freshIds = incoming.filter((order) => !knownOrderIds.current.has(order.id)).map((order) => order.id)
        if (freshIds.length > 0) {
          setNewOrderIds(freshIds)
          await announceNewOrder()
          window.clearTimeout(highlightTimer.current)
          highlightTimer.current = window.setTimeout(() => setNewOrderIds([]), 12000)
        }
      }
      knownOrderIds.current = new Set(incoming.map((order) => order.id))
      initialized.current = true
      setOrders(incoming)
      setError('')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoading(false)
      requestRunning.current = false
    }
  }, [announceNewOrder, token])

  useEffect(() => {
    initialized.current = false
    knownOrderIds.current = new Set()
    loadOrders(false)
    const interval = window.setInterval(() => loadOrders(true), 8000)
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') loadOrders(true) }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(highlightTimer.current)
      window.clearTimeout(voiceTimer.current)
      window.speechSynthesis?.cancel()
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [loadOrders])

  async function toggleSound() {
    if (soundEnabled && soundReady) {
      setSoundEnabled(false)
      setSoundReady(false)
      localStorage.setItem(tenantStorageKey('order_bell'), 'off')
      window.clearTimeout(voiceTimer.current)
      window.speechSynthesis?.cancel()
      return
    }

    setSoundEnabled(true)
    localStorage.setItem(tenantStorageKey('order_bell'), 'on')
    await announceNewOrder(true)
  }

  async function changeStatus(order, status) {
    setUpdatingId(order.id); setError('')
    try {
      const data = await api(`/admin/orders/${order.id}`, { token, method: 'PATCH', body: { status } })
      setOrders((current) => current.map((item) => item.id === order.id ? data.order : item))
      setSelectedOrder((current) => current?.id === order.id ? data.order : current)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setUpdatingId('')
    }
  }

  async function openOrder(order) {
    setSelectedOrder(order)
    setError('')
    try {
      const data = await api(`/admin/orders/${order.id}`, { token })
      setSelectedOrder(data.order)
    } catch (reason) {
      setSelectedOrder(null)
      setError(reason.message)
    }
  }

  async function changePaymentStatus(order, status) {
    setUpdatingPaymentId(order.id); setError('')
    try {
      const data = await api(`/admin/orders/${order.id}/payment`, { token, method: 'PATCH', body: { status } })
      setOrders((current) => current.map((item) => item.id === order.id ? data.order : item))
      setSelectedOrder(data.order)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setUpdatingPaymentId('')
    }
  }

  const activeOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status))
  const revenue = orders.reduce((sum, order) => sum + order.total_cents, 0)
  return <><section className="metrics"><article><span className="metric-icon orange"><ShoppingBag /></span><div><small>Pedidos</small><strong>{orders.length}</strong><em>registrados na loja</em></div></article><article><span className="metric-icon green"><span>R$</span></span><div><small>Faturamento</small><strong>{money(revenue)}</strong><em>pedidos carregados</em></div></article><article><span className="metric-icon blue"><Clock3 /></span><div><small>Em andamento</small><strong>{activeOrders.length}</strong><em>aguardando a equipe</em></div></article><article><span className="metric-icon purple"><PackageCheck /></span><div><small>Concluídos</small><strong>{orders.filter((order) => order.status === 'completed').length}</strong><em>finalizados</em></div></article></section><section className="admin-content-card"><div className="content-card-heading"><div><span className="eyebrow">Operação · atualização automática a cada 8 segundos</span><h2>Pedidos recentes</h2></div><button type="button" className={`order-bell-toggle ${soundEnabled && soundReady ? 'active' : ''}`} onClick={toggleSound}>{soundEnabled && soundReady ? <Bell /> : <BellOff />}<span>{soundEnabled && soundReady ? 'Aviso por voz ativo' : 'Ativar aviso por voz'}</span></button></div>{error && !selectedOrder && <div className="admin-alert error">{error}</div>}{loading ? <p className="loading-line">Carregando pedidos...</p> : orders.length === 0 ? <EmptyState icon={ShoppingBag} title="Nenhum pedido ainda" text="Os novos pedidos do cardápio aparecerão aqui automaticamente." /> : <div className="admin-order-table">{orders.map((order) => <article className={`${newOrderIds.includes(order.id) ? 'new-order-arrival ' : ''}order-row-clickable`} key={order.id} role="button" tabIndex="0" title="Abrir detalhes do pedido" onClick={() => openOrder(order)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openOrder(order) }}><b>#{order.number}</b><span className="order-customer-cell">{order.customer_snapshot?.name}<small className={`order-payment-badge ${order.payment_status}`}>{paymentStatusLabels[order.payment_status] || order.payment_status}</small>{order.scheduled_for && <small className="order-scheduled-badge"><Clock3 /> {dateTime(order.scheduled_for)}</small>}</span><span>{order.items?.length} item(ns)</span><strong>{money(order.total_cents)}</strong><label className={`order-status-control ${order.status}`} onClick={(event) => event.stopPropagation()}><select aria-label={`Status do pedido ${order.number}`} value={order.status} disabled={updatingId === order.id} onChange={(event) => changeStatus(order, event.target.value)}>{orderStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></article>)}</div>}</section>{selectedOrder && <OrderDetails order={selectedOrder} store={store} updating={updatingId === selectedOrder.id} updatingPayment={updatingPaymentId === selectedOrder.id} error={error} onClose={() => { setSelectedOrder(null); setError('') }} onStatusChange={changeStatus} onPaymentChange={changePaymentStatus} />}</>
}

function CustomerEditor({ customer: initialCustomer, token, onClose, onChanged }) {
  const [customer, setCustomer] = useState(initialCustomer)
  const [form, setForm] = useState({ name: initialCustomer.name, phone: initialCustomer.phone, email: initialCustomer.email || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const data = await api(`/admin/customers/${customer.id}`, { token, method: 'PATCH', body: { ...form, email: form.email || null } })
      setCustomer(data.customer)
      setForm({ name: data.customer.name, phone: data.customer.phone, email: data.customer.email || '' })
      onChanged()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeAddress(address) {
    if (!window.confirm(`Remover o endereço “${address.label}”?`)) return
    setError('')
    try {
      await api(`/admin/customers/${customer.id}/addresses/${address.id}`, { token, method: 'DELETE' })
      setCustomer((current) => ({ ...current, addresses: current.addresses.filter((item) => item.id !== address.id) }))
    } catch (reason) {
      setError(reason.message)
    }
  }

  return <div className="overlay"><section className="admin-modal customer-modal"><header><div><span className="eyebrow">Clientes</span><h2>{customer.name}</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></header><div className="admin-modal-body customer-modal-body">{error && <div className="admin-alert error">{error}</div>}<div className="customer-detail-grid"><div className="customer-detail-column"><form className="admin-form-card" onSubmit={save}><div className="form-card-title"><div><h3>Dados do cliente</h3><p>Informações usadas nos próximos pedidos.</p></div></div><label>Nome<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label><label>Telefone<input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label><button className="primary-button customer-save" disabled={saving}><Save /> {saving ? 'Salvando...' : 'Salvar cliente'}</button></form><section className="admin-form-card"><div className="form-card-title"><div><h3>Endereços</h3><p>{customer.addresses.length} endereço(s) cadastrado(s).</p></div></div><div className="customer-address-list">{customer.addresses.length === 0 ? <p className="muted-help">Nenhum endereço salvo.</p> : customer.addresses.map((address) => <article key={address.id}><MapPin /><div><b>{address.label}</b><span>{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ''}</span><small>{address.neighborhood} · {address.city}/{address.state} · {address.postal_code}</small></div><button type="button" title="Remover endereço" onClick={() => removeAddress(address)}><Trash2 /></button></article>)}</div></section></div><section className="admin-form-card customer-orders"><div className="form-card-title"><div><h3>Histórico de pedidos</h3><p>{customer.orders_count} pedido(s) · {money(customer.orders_sum_total_cents)}</p></div></div>{customer.orders.length === 0 ? <p className="muted-help">Este cliente ainda não possui pedidos.</p> : <div className="customer-order-list">{customer.orders.map((order) => <article key={order.id}><div><b>Pedido #{order.number}</b><small>{dateTime(order.placed_at)}</small></div><div className="customer-order-products">{order.items.slice(0, 3).map((item) => <span key={item.id}>{item.quantity}× {item.product_name}</span>)}{order.items.length > 3 && <small>+ {order.items.length - 3} item(ns)</small>}</div><strong>{money(order.total_cents)}</strong><em className={`status-label ${order.status}`}>{orderStatusLabel(order.status)}</em></article>)}</div>}</section></div></div></section></div>
}

function CustomersView({ token }) {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api(`/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token })
      setCustomers(data.customers)
      setError('')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setLoading(false)
    }
  }, [search, token])

  useEffect(() => {
    const timeout = window.setTimeout(loadCustomers, 300)
    return () => window.clearTimeout(timeout)
  }, [loadCustomers])

  async function openCustomer(customer) {
    setError('')
    try {
      const data = await api(`/admin/customers/${customer.id}`, { token })
      setSelected(data.customer)
    } catch (reason) {
      setError(reason.message)
    }
  }

  const totalRevenue = customers.reduce((sum, customer) => sum + Number(customer.orders_sum_total_cents || 0), 0)
  const customersWithOrders = customers.filter((customer) => customer.orders_count > 0).length

  return <><section className="metrics customer-metrics"><article><span className="metric-icon orange"><Users /></span><div><small>Clientes</small><strong>{customers.length}</strong><em>na busca atual</em></div></article><article><span className="metric-icon green"><ShoppingBag /></span><div><small>Compraram</small><strong>{customersWithOrders}</strong><em>clientes com pedidos</em></div></article><article><span className="metric-icon blue"><span>R$</span></span><div><small>Valor movimentado</small><strong>{money(totalRevenue)}</strong><em>pelos clientes listados</em></div></article></section><section className="admin-content-card"><div className="content-card-heading customer-heading"><div><span className="eyebrow">Relacionamento</span><h2>Clientes</h2></div><label className="admin-customer-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, telefone ou e-mail" /></label></div>{error && <div className="admin-alert error">{error}</div>}{loading ? <p className="loading-line">Carregando clientes...</p> : customers.length === 0 ? <EmptyState icon={Users} title="Nenhum cliente encontrado" text="Os clientes aparecem aqui depois do primeiro pedido." /> : <div className="customer-table">{customers.map((customer) => <button type="button" key={customer.id} onClick={() => openCustomer(customer)}><span className="customer-avatar">{customer.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="customer-main"><b>{customer.name}</b><small><Phone /> {customer.phone}{customer.email && <><Mail /> {customer.email}</>}</small></span><span><small>Pedidos</small><b>{customer.orders_count}</b></span><span><small>Total</small><b>{money(customer.orders_sum_total_cents)}</b></span><span><small>Último pedido</small><b>{dateTime(customer.orders_max_placed_at)}</b></span><ChevronRight /></button>)}</div>}</section>{selected && <CustomerEditor customer={selected} token={token} onClose={() => setSelected(null)} onChanged={loadCustomers} />}</>
}

const emptyProduct = (categoryId = '') => ({ category_id: categoryId, name: '', description: '', image_url: '', price: '', active: true, is_sold_out: false, variants: [], modifier_groups: [] })

function ProductEditor({ product, categories, onClose, onSave }) {
  const [form, setForm] = useState(product ? {
    ...product,
    price: fromCents(product.price_cents),
    variants: (product.variants || []).map((item) => ({ name: item.name, price: fromCents(item.price_delta_cents), is_default: item.is_default })),
    modifier_groups: (product.modifier_groups || []).map((group) => ({ name: group.name, min_choices: group.min_choices, max_choices: group.max_choices, options: (group.options || []).map((option) => ({ name: option.name, price: fromCents(option.price_cents) })) })),
  } : emptyProduct(categories[0]?.id))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const updateVariant = (index, field, value) => setForm((current) => ({ ...current, variants: current.variants.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }))
  const updateGroup = (groupIndex, field, value) => setForm((current) => ({ ...current, modifier_groups: current.modifier_groups.map((group, index) => index === groupIndex ? { ...group, [field]: value } : group) }))
  const updateOption = (groupIndex, optionIndex, field, value) => setForm((current) => ({ ...current, modifier_groups: current.modifier_groups.map((group, index) => index === groupIndex ? { ...group, options: group.options.map((option, innerIndex) => innerIndex === optionIndex ? { ...option, [field]: value } : option) } : group) }))

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    const payload = {
      category_id: form.category_id, name: form.name, description: form.description || null, image_url: form.image_url || null,
      price_cents: toCents(form.price), active: form.active, is_sold_out: form.is_sold_out, availability: null,
      variants: form.variants.map((item) => ({ name: item.name, price_delta_cents: toCents(item.price), is_default: item.is_default })),
      modifier_groups: form.modifier_groups.map((group) => ({ name: group.name, min_choices: Number(group.min_choices), max_choices: Number(group.max_choices), options: group.options.map((option) => ({ name: option.name, price_cents: toCents(option.price) })) })),
    }
    try { await onSave(payload, product?.id); onClose() } catch (reason) { setError(reason.message) } finally { setSaving(false) }
  }

  return <div className="overlay"><form className="admin-modal product-editor" onSubmit={submit}><header><div><span className="eyebrow">Cardápio</span><h2>{product ? 'Editar produto' : 'Novo produto'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></header><div className="admin-modal-body"><section className="editor-grid"><div className="editor-main"><div className="admin-form-card"><h3>Informações principais</h3><label>Nome do produto<input value={form.name} onChange={(event) => set('name', event.target.value)} required placeholder="Ex.: Pizza Margherita" /></label><label>Descrição<textarea value={form.description || ''} onChange={(event) => set('description', event.target.value)} rows="3" placeholder="Conte os ingredientes e diferenciais" /></label><div className="field-grid"><label>Categoria<select value={form.category_id} onChange={(event) => set('category_id', event.target.value)} required>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Preço base (R$)<input inputMode="decimal" value={form.price} onChange={(event) => set('price', event.target.value)} required placeholder="49,90" /></label></div><label>URL da foto<input type="url" value={form.image_url || ''} onChange={(event) => set('image_url', event.target.value)} placeholder="https://..." /></label><div className="toggle-grid"><label className="toggle-row"><input type="checkbox" checked={form.active} onChange={(event) => set('active', event.target.checked)} /><span><b>Visível no cardápio</b><small>Ocultar remove o produto da vitrine.</small></span></label><label className="toggle-row"><input type="checkbox" checked={form.is_sold_out} onChange={(event) => set('is_sold_out', event.target.checked)} /><span><b>Produto esgotado</b><small>Continua visível, mas não pode ser pedido.</small></span></label></div></div>
            <div className="admin-form-card"><div className="form-card-title"><div><h3>Variações</h3><p>Tamanhos ou versões do produto.</p></div><button type="button" className="small-action" onClick={() => set('variants', [...form.variants, { name: '', price: '0,00', is_default: form.variants.length === 0 }])}><Plus /> Adicionar</button></div>{form.variants.length === 0 ? <p className="muted-help">Este produto tem apenas o preço base.</p> : form.variants.map((variant, index) => <div className="dynamic-row" key={index}><input value={variant.name} onChange={(event) => updateVariant(index, 'name', event.target.value)} required placeholder="Ex.: Grande" /><input value={variant.price} onChange={(event) => updateVariant(index, 'price', event.target.value)} required placeholder="Adicional R$" /><label title="Variação padrão"><input type="radio" name="default-variant" checked={variant.is_default} onChange={() => set('variants', form.variants.map((item, itemIndex) => ({ ...item, is_default: itemIndex === index })))} /> Padrão</label><button type="button" className="remove-row" onClick={() => set('variants', form.variants.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div>)}</div>
            <div className="admin-form-card"><div className="form-card-title"><div><h3>Grupos de adicionais</h3><p>Bordas, acompanhamentos e escolhas.</p></div><button type="button" className="small-action" onClick={() => set('modifier_groups', [...form.modifier_groups, { name: '', min_choices: 0, max_choices: 1, options: [{ name: '', price: '0,00' }] }])}><Plus /> Novo grupo</button></div>{form.modifier_groups.length === 0 && <p className="muted-help">Nenhum adicional configurado.</p>}{form.modifier_groups.map((group, groupIndex) => <div className="modifier-editor" key={groupIndex}><div className="modifier-head"><input value={group.name} onChange={(event) => updateGroup(groupIndex, 'name', event.target.value)} required placeholder="Nome do grupo" /><label>Mín. <input type="number" min="0" value={group.min_choices} onChange={(event) => updateGroup(groupIndex, 'min_choices', event.target.value)} /></label><label>Máx. <input type="number" min="1" value={group.max_choices} onChange={(event) => updateGroup(groupIndex, 'max_choices', event.target.value)} /></label><button type="button" className="remove-row" onClick={() => set('modifier_groups', form.modifier_groups.filter((_, index) => index !== groupIndex))}><Trash2 /></button></div>{group.options.map((option, optionIndex) => <div className="option-editor" key={optionIndex}><input value={option.name} onChange={(event) => updateOption(groupIndex, optionIndex, 'name', event.target.value)} required placeholder="Nome da opção" /><input value={option.price} onChange={(event) => updateOption(groupIndex, optionIndex, 'price', event.target.value)} required placeholder="Preço R$" /><button type="button" className="remove-row" onClick={() => updateGroup(groupIndex, 'options', group.options.filter((_, index) => index !== optionIndex))}><X /></button></div>)}<button type="button" className="add-option" onClick={() => updateGroup(groupIndex, 'options', [...group.options, { name: '', price: '0,00' }])}><Plus /> Adicionar opção</button></div>)}</div>
          </div><aside className="product-preview"><span>Prévia</span><div className="preview-image">{form.image_url ? <img src={form.image_url} alt="" /> : <Image />}</div><h3>{form.name || 'Nome do produto'}</h3><p>{form.description || 'A descrição aparecerá aqui.'}</p><b>{form.price ? `A partir de ${money(toCents(form.price))}` : 'Informe o preço'}</b></aside></section>{error && <div className="admin-alert error">{error}</div>}</div><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}><Save /> {saving ? 'Salvando...' : 'Salvar produto'}</button></footer></form></div>
}

function MenuManager({ token }) {
  const [categories, setCategories] = useState([]), [selectedId, setSelectedId] = useState(''), [newCategory, setNewCategory] = useState(''), [editing, setEditing] = useState(undefined), [loading, setLoading] = useState(true), [message, setMessage] = useState('')
  const selected = categories.find((category) => category.id === selectedId) || categories[0]

  async function load(preferredId) {
    const data = await api('/admin/menu', { token }); setCategories(data.categories); setSelectedId(preferredId || selectedId || data.categories[0]?.id || ''); setLoading(false)
  }
  useEffect(() => { let active = true; api('/admin/menu', { token }).then((data) => { if (active) { setCategories(data.categories); setSelectedId(data.categories[0]?.id || ''); setLoading(false) } }).catch((reason) => active && setMessage(reason.message)); return () => { active = false } }, [token])

  async function addCategory(event) { event.preventDefault(); if (!newCategory.trim()) return; try { const data = await api('/admin/categories', { token, method: 'POST', body: { name: newCategory } }); setNewCategory(''); await load(data.category.id); setMessage('Categoria criada.') } catch (reason) { setMessage(reason.message) } }
  async function renameCategory() { const name = window.prompt('Novo nome da categoria:', selected?.name); if (!name?.trim()) return; try { await api(`/admin/categories/${selected.id}`, { token, method: 'PATCH', body: { name } }); await load(selected.id); setMessage('Categoria renomeada.') } catch (reason) { setMessage(reason.message) } }
  async function removeCategory() { if (!selected || !window.confirm(`Excluir a categoria “${selected.name}”?`)) return; try { await api(`/admin/categories/${selected.id}`, { token, method: 'DELETE' }); await load(); setMessage('Categoria excluída.') } catch (reason) { setMessage(reason.message) } }
  async function saveProduct(payload, id) { await api(id ? `/admin/products/${id}` : '/admin/products', { token, method: id ? 'PUT' : 'POST', body: payload }); await load(payload.category_id); setMessage(id ? 'Produto atualizado.' : 'Produto criado.') }
  async function toggleSoldOut(product) { try { await api(`/admin/products/${product.id}/availability`, { token, method: 'PATCH', body: { is_sold_out: !product.is_sold_out } }); await load(selected.id); setMessage(product.is_sold_out ? 'Produto disponível novamente.' : 'Produto marcado como esgotado.') } catch (reason) { setMessage(reason.message) } }
  async function removeProduct(product) { if (!window.confirm(`Excluir “${product.name}”?`)) return; try { await api(`/admin/products/${product.id}`, { token, method: 'DELETE' }); await load(selected.id); setMessage('Produto excluído.') } catch (reason) { setMessage(reason.message) } }

  if (loading) return <p className="loading-line">Carregando cardápio...</p>
  return <section className="menu-manager"><div className="category-panel"><div><span className="eyebrow">Organização</span><h2>Categorias</h2></div><form onSubmit={addCategory}><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Nova categoria" /><button><Plus /></button></form><nav>{categories.map((category) => <button className={selected?.id === category.id ? 'active' : ''} onClick={() => setSelectedId(category.id)} key={category.id}><span><b>{category.name}</b><small>{category.products?.length || 0} produtos</small></span><ChevronRight /></button>)}</nav>{selected && <div className="category-actions"><button onClick={renameCategory}><Pencil /> Renomear</button><button disabled={selected.products.length > 0} onClick={removeCategory}><Trash2 /> Excluir</button></div>}</div><div className="products-panel"><div className="content-card-heading"><div><span className="eyebrow">Cardápio</span><h2>{selected?.name || 'Crie uma categoria'}</h2></div>{selected && <button className="primary-button" onClick={() => setEditing(null)}><Plus /> Novo produto</button>}</div>{message && <div className="admin-alert success">{message}</div>}{!selected ? <EmptyState icon={Menu} title="Comece por uma categoria" text="Crie a primeira seção do seu cardápio ao lado." /> : selected.products.length === 0 ? <EmptyState icon={ShoppingBag} title="Categoria vazia" text="Adicione o primeiro produto desta categoria." /> : <div className="product-admin-grid">{selected.products.map((product) => <article className={product.is_sold_out ? 'sold-out' : ''} key={product.id}><div className="admin-product-image">{product.image_url ? <img src={product.image_url} alt="" /> : <Image />}<span className={!product.active ? 'unavailable' : product.is_sold_out ? 'sold-out' : 'available'}>{!product.active ? 'Oculto' : product.is_sold_out ? 'Esgotado' : 'Disponível'}</span></div><div><h3>{product.name}</h3><p>{product.description}</p><b>{money(product.price_cents)}</b><small>{product.variants?.length || 0} variações · {product.modifier_groups?.length || 0} grupos</small></div><footer><button className={`stock-toggle ${product.is_sold_out ? 'restore' : ''}`} onClick={() => toggleSoldOut(product)}>{product.is_sold_out ? <PackageCheck /> : <PackageX />} {product.is_sold_out ? 'Repor' : 'Esgotado'}</button><button onClick={() => setEditing(product)}><Pencil /> Editar</button><button className="danger" onClick={() => removeProduct(product)}><Trash2 /></button></footer></article>)}</div>}</div>{editing !== undefined && <ProductEditor product={editing} categories={categories} onClose={() => setEditing(undefined)} onSave={saveProduct} />}</section>
}

function BusinessHoursEditor({ value, onChange }) {
  const schedule = value.schedule || emptySchedule()
  const setDay = (day, intervals) => onChange({ ...value, schedule: { ...schedule, [day]: intervals } })
  const updateInterval = (day, index, field, nextValue) => setDay(day, schedule[day].map((interval, intervalIndex) => intervalIndex === index ? { ...interval, [field]: nextValue } : interval))

  return <div className="business-hours-editor"><div className="business-hours-heading"><b>Grade semanal</b><small>Cadastre até quatro períodos por dia.</small></div>{scheduleDays.map(([day, label]) => <div className="business-day" key={day}><strong>{label}</strong><div>{schedule[day].length === 0 ? <span>Fechado</span> : schedule[day].map((interval, index) => <div className="business-interval" key={index}><input type="time" value={interval.open} onChange={(event) => updateInterval(day, index, 'open', event.target.value)} required /><em>até</em><input type="time" value={interval.close} onChange={(event) => updateInterval(day, index, 'close', event.target.value)} required /><button type="button" onClick={() => setDay(day, schedule[day].filter((_, intervalIndex) => intervalIndex !== index))}><X /></button></div>)}</div><button type="button" disabled={schedule[day].length >= 4} onClick={() => setDay(day, [...schedule[day], { open: '18:00', close: '23:00' }])}><Plus /></button></div>)}</div>
}

const SECTION_META = {
  hero: { label: 'Destaque (topo)', hint: 'Título, foto e chamada principal', toggleable: true },
  services: { label: 'Faixa de serviços', hint: 'Entrega, horário e localização', toggleable: true },
  menu: { label: 'Cardápio', hint: 'Categorias e produtos (sempre visível)', toggleable: false },
  story: { label: 'Nossa história', hint: 'Texto e foto sobre a loja', toggleable: true },
}
const HERO_LAYOUTS = [['split', 'Dividido'], ['centered', 'Centralizado'], ['compact', 'Compacto']]
const CARD_LAYOUTS = [['grid', 'Grade'], ['list', 'Lista']]
const CORNER_STYLES = [['soft', 'Suave'], ['square', 'Reto'], ['round', 'Arredondado']]

function Segmented({ value, options, onChange }) {
  return <div className="segmented">{options.map(([option, label]) => <button type="button" key={option} className={value === option ? 'active' : ''} onClick={() => onChange(option)}>{label}</button>)}</div>
}

function SiteEditor({ token, onStoreChange }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [message, setMessage] = useState('')
  const [hasError, setHasError] = useState(false)
  const [device, setDevice] = useState('desktop')
  const [dragOver, setDragOver] = useState(null)
  const frameRef = useRef(null)
  const frameReady = useRef(false)
  const dragIndex = useRef(null)

  useEffect(() => {
    let active = true
    api('/admin/settings', { token }).then((data) => active && setForm(normalizeSettings(data.settings))).catch((reason) => { if (active) { setMessage(reason.message); setHasError(true) } })
    return () => { active = false }
  }, [token])

  const payloadKey = form ? JSON.stringify({
    store_name: form.store_name, tagline: form.tagline, logo_url: form.logo_url, banner_url: form.banner_url,
    primary_color: form.primary_color, accent_color: form.accent_color,
    storefront_content: form.storefront_content, storefront_design: form.storefront_design,
  }) : ''

  const postPreview = useCallback(() => {
    if (!frameReady.current || !frameRef.current || !payloadKey) return
    frameRef.current.contentWindow?.postMessage({ type: 'cardapio-preview', payload: JSON.parse(payloadKey) }, '*')
  }, [payloadKey])

  useEffect(() => {
    const onMessage = (event) => { if (event.data?.type === 'cardapio-preview-ready') { frameReady.current = true; postPreview() } }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [postPreview])
  useEffect(() => { postPreview() }, [postPreview])

  if (!form) return <p className="loading-line">Carregando editor do site...</p>
  const design = form.storefront_design
  const content = form.storefront_content || {}
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const setContent = (field, value) => setForm((current) => ({ ...current, storefront_content: { ...current.storefront_content, [field]: value } }))
  const setDesign = (field, value) => setForm((current) => ({ ...current, storefront_design: { ...current.storefront_design, [field]: value } }))
  const setSection = (key, value) => setForm((current) => ({ ...current, storefront_design: { ...current.storefront_design, sections: { ...current.storefront_design.sections, [key]: value } } }))
  const resetDesign = () => setForm((current) => ({ ...current, storefront_design: { ...DEFAULT_DESIGN, story_image_url: current.storefront_design.story_image_url } }))

  const handleDrop = (index) => {
    const from = dragIndex.current
    setDragOver(null)
    dragIndex.current = null
    if (from === null || from === index) return
    const order = [...design.section_order]
    const [moved] = order.splice(from, 1)
    order.splice(index, 0, moved)
    setDesign('section_order', order)
  }

  async function uploadAsset(kind, file) {
    const formData = new FormData()
    formData.append('kind', kind)
    if (kind === 'story') formData.append('draft', '1')
    formData.append('image', file)
    setUploading(kind); setMessage(''); setHasError(false)
    try {
      const data = await api('/admin/settings/assets', { token, method: 'POST', formData })
      if (kind === 'story') setDesign('story_image_url', data.url)
      else setForm((current) => ({ ...current, [`${kind}_url`]: data.url }))
      setMessage('Imagem enviada. Clique em publicar para aplicar no site.')
    } catch (reason) { setMessage(reason.message); setHasError(true) } finally { setUploading('') }
  }

  async function save(event) {
    event.preventDefault(); setSaving(true); setMessage(''); setHasError(false)
    try {
      const payload = {
        ...form,
        delivery_fee_cents: toCents(form.delivery_fee),
        delivery_zones: form.delivery_zones.filter((zone) => zone.neighborhood.trim()).map((zone) => ({ neighborhood: zone.neighborhood, city: zone.city || null, state: zone.state || null, fee_cents: toCents(zone.fee), active: zone.active !== false })),
        minimum_order_cents: toCents(form.minimum_order),
        estimated_delivery_minutes: Number(form.estimated_delivery_minutes),
      }
      delete payload.delivery_fee; delete payload.minimum_order; delete payload.created_at; delete payload.updated_at; delete payload.tenant_id
      const data = await api('/admin/settings', { token, method: 'PUT', body: payload })
      setForm(normalizeSettings(data.settings)); onStoreChange(data.settings)
      setMessage('Site publicado com sucesso.')
    } catch (reason) { setMessage(reason.message); setHasError(true) } finally { setSaving(false) }
  }

  const base = tenantUrl('/')
  const previewUrl = base.includes('?') ? `${base}&preview=1` : `${base}?preview=1`

  return <form className="site-editor-form" onSubmit={save}>
    <div className="settings-heading"><div><span className="eyebrow">Sem código</span><h2>Editor do site</h2><p>Personalize a página pública e veja a prévia em tempo real.</p></div><button className="primary-button" disabled={saving || Boolean(uploading)}><Save /> {saving ? 'Publicando...' : 'Publicar site'}</button></div>
    {message && <div className={`admin-alert ${hasError ? 'error' : 'success'}`}>{message}</div>}
    <div className="site-editor">
      <div className="site-editor-controls">
        <section className="admin-form-card"><div className="settings-section-title"><Sparkles /><div><h3>Identidade</h3><p>Nome, frase e imagens.</p></div></div>
          <label>Nome da loja<input value={form.store_name} onChange={(event) => set('store_name', event.target.value)} required /></label>
          <label>Frase de apresentação<textarea value={form.tagline || ''} onChange={(event) => set('tagline', event.target.value)} rows="2" /></label>
          <div className="brand-assets-grid"><BrandAssetUpload kind="logo" label="Logo" value={form.logo_url} uploading={uploading} onUpload={uploadAsset} /><BrandAssetUpload kind="banner" label="Banner" value={form.banner_url} uploading={uploading} onUpload={uploadAsset} /></div>
        </section>
        <section className="admin-form-card"><div className="settings-section-title"><Palette /><div><h3>Cores</h3><p>Paleta aplicada em toda a página.</p></div></div>
          <div className="color-fields">
            <label>Fundo da página<div><input type="color" value={design.background_color} onChange={(event) => setDesign('background_color', event.target.value)} /><input value={design.background_color} onChange={(event) => setDesign('background_color', event.target.value)} /></div></label>
            <label>Cartões<div><input type="color" value={design.surface_color} onChange={(event) => setDesign('surface_color', event.target.value)} /><input value={design.surface_color} onChange={(event) => setDesign('surface_color', event.target.value)} /></div></label>
            <label>Texto<div><input type="color" value={design.text_color} onChange={(event) => setDesign('text_color', event.target.value)} /><input value={design.text_color} onChange={(event) => setDesign('text_color', event.target.value)} /></div></label>
            <label>Cor principal<div><input type="color" value={form.primary_color} onChange={(event) => set('primary_color', event.target.value)} /><input value={form.primary_color} onChange={(event) => set('primary_color', event.target.value)} /></div></label>
            <label>Cor de apoio<div><input type="color" value={form.accent_color} onChange={(event) => set('accent_color', event.target.value)} /><input value={form.accent_color} onChange={(event) => set('accent_color', event.target.value)} /></div></label>
          </div>
        </section>
        <section className="admin-form-card"><div className="settings-section-title"><LayoutTemplate /><div><h3>Layout</h3><p>Formato dos blocos principais.</p></div></div>
          <div className="editor-field"><span>Destaque do topo</span><Segmented value={design.hero_layout} options={HERO_LAYOUTS} onChange={(value) => setDesign('hero_layout', value)} /></div>
          <div className="editor-field"><span>Cartões do cardápio</span><Segmented value={design.card_layout} options={CARD_LAYOUTS} onChange={(value) => setDesign('card_layout', value)} /></div>
          <div className="editor-field"><span>Cantos</span><Segmented value={design.corner_style} options={CORNER_STYLES} onChange={(value) => setDesign('corner_style', value)} /></div>
          <button type="button" className="reset-design" onClick={resetDesign}><RotateCcw /> Restaurar visual padrão</button>
        </section>
        <section className="admin-form-card"><div className="settings-section-title"><LayoutDashboard /><div><h3>Seções da página</h3><p>Arraste para reordenar e ligue/desligue.</p></div></div>
          <div className="section-order-list">{design.section_order.map((key, index) => { const meta = SECTION_META[key]; const on = key === 'menu' || design.sections[key]; return <article key={key} className={`section-order-item${dragOver === index ? ' drag-over' : ''}${on ? '' : ' off'}`} draggable onDragStart={() => { dragIndex.current = index }} onDragOver={(event) => { event.preventDefault(); setDragOver(index) }} onDragLeave={() => setDragOver((current) => current === index ? null : current)} onDrop={() => handleDrop(index)} onDragEnd={() => { setDragOver(null); dragIndex.current = null }}><span className="section-drag-handle" title="Arraste para reordenar"><GripVertical /></span><div className="section-order-info"><b>{meta.label}</b><small>{meta.hint}</small></div>{meta.toggleable ? <label className="section-switch" title={design.sections[key] ? 'Ocultar seção' : 'Mostrar seção'}><input type="checkbox" checked={design.sections[key]} onChange={(event) => setSection(key, event.target.checked)} /><i /></label> : <span className="section-fixed">Fixo</span>}</article> })}</div>
          <label className="toggle-row footer-toggle"><input type="checkbox" checked={design.sections.footer} onChange={(event) => setSection('footer', event.target.checked)} /><span><b>Rodapé</b><small>Endereço, horário e link do painel.</small></span></label>
        </section>
        <section className="admin-form-card"><div className="settings-section-title"><Pencil /><div><h3>Textos</h3><p>O que aparece escrito na página.</p></div></div>
          <label>Selo de atendimento<input value={content.hero_badge || ''} onChange={(event) => setContent('hero_badge', event.target.value)} placeholder="Estamos abertos" /></label>
          <div className="field-grid"><label>Título principal<input value={content.hero_title || ''} onChange={(event) => setContent('hero_title', event.target.value)} placeholder="Comida que abraça a" /></label><label>Destaque do título<input value={content.hero_highlight || ''} onChange={(event) => setContent('hero_highlight', event.target.value)} placeholder="mesa." /></label></div>
          <label>Texto sobre a foto<input value={content.hero_note || ''} onChange={(event) => setContent('hero_note', event.target.value)} placeholder="feito com afeto ↗" /></label>
          <label>Título do cardápio<input value={content.menu_title || ''} onChange={(event) => setContent('menu_title', event.target.value)} /></label>
          <label>Chamada da história<input value={content.story_eyebrow || ''} onChange={(event) => setContent('story_eyebrow', event.target.value)} placeholder="Nossa cozinha" /></label>
          <label>Título da história<input value={content.story_title || ''} onChange={(event) => setContent('story_title', event.target.value)} /></label>
          <label>História da loja<textarea value={content.story_text || ''} onChange={(event) => setContent('story_text', event.target.value)} rows="4" /></label>
          <label>Complemento da assinatura<input value={content.story_since || ''} onChange={(event) => setContent('story_since', event.target.value)} placeholder="desde 2018" /></label>
        </section>
        <section className="admin-form-card"><div className="settings-section-title"><Image /><div><h3>Foto da história</h3><p>Imagem exibida na seção "Nossa história".</p></div></div>
          <BrandAssetUpload kind="story" label="Foto da história" value={design.story_image_url} uploading={uploading} onUpload={uploadAsset} />
          {design.story_image_url && <button type="button" className="reset-design" onClick={() => setDesign('story_image_url', null)}><Trash2 /> Remover foto</button>}
        </section>
      </div>
      <div className="site-editor-preview">
        <div className="preview-toolbar"><span><Eye /> Prévia ao vivo</span><div className="preview-devices"><button type="button" className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')} title="Computador"><Monitor /></button><button type="button" className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')} title="Celular"><Smartphone /></button></div><a href={previewUrl.replace('&preview=1', '').replace('?preview=1', '')} target="_blank" rel="noreferrer" className="preview-open">Abrir site</a></div>
        <div className={`preview-stage ${device}`}><iframe ref={frameRef} src={previewUrl} title="Prévia do site" /></div>
      </div>
    </div>
  </form>
}

function SettingsManager({ token, onStoreChange }) {
  const [form, setForm] = useState(null), [saving, setSaving] = useState(false), [uploading, setUploading] = useState(''), [message, setMessage] = useState(''), [hasError, setHasError] = useState(false)
  useEffect(() => { let active = true; api('/admin/settings', { token }).then((data) => active && setForm(normalizeSettings(data.settings))).catch((reason) => { if (active) { setMessage(reason.message); setHasError(true) } }); return () => { active = false } }, [token])
  if (!form) return <p className="loading-line">Carregando configurações...</p>
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value })); const nested = (group, field, value) => setForm((current) => ({ ...current, [group]: { ...current[group], [field]: value } }))
  async function uploadAsset(kind, file) { const formData = new FormData(); formData.append('kind', kind); formData.append('image', file); setUploading(kind); setMessage(''); setHasError(false); try { const data = await api('/admin/settings/assets', { token, method: 'POST', formData }); setForm((current) => ({ ...current, [`${kind}_url`]: data.url })); setMessage(`${kind === 'logo' ? 'Logo' : 'Banner'} enviado e publicado.`) } catch (reason) { setMessage(reason.message); setHasError(true) } finally { setUploading('') } }
  const updateDeliveryZone = (index, field, value) => setForm((current) => ({ ...current, delivery_zones: current.delivery_zones.map((zone, zoneIndex) => zoneIndex === index ? { ...zone, [field]: value } : zone) }))
  const addDeliveryZone = () => setForm((current) => ({ ...current, delivery_zones: [...current.delivery_zones, { neighborhood: '', city: current.address.city || '', state: current.address.state || '', fee: current.delivery_fee, active: true }] }))
  const removeDeliveryZone = (index) => setForm((current) => ({ ...current, delivery_zones: current.delivery_zones.filter((_, zoneIndex) => zoneIndex !== index) }))
  async function save(event) { event.preventDefault(); setSaving(true); setMessage(''); setHasError(false); try { const payload = { ...form, delivery_fee_cents: toCents(form.delivery_fee), delivery_zones: form.delivery_zones.filter((zone) => zone.neighborhood.trim()).map((zone) => ({ neighborhood: zone.neighborhood, city: zone.city || null, state: zone.state || null, fee_cents: toCents(zone.fee), active: zone.active !== false })), minimum_order_cents: toCents(form.minimum_order), estimated_delivery_minutes: Number(form.estimated_delivery_minutes) }; delete payload.delivery_fee; delete payload.minimum_order; delete payload.created_at; delete payload.updated_at; delete payload.tenant_id; const data = await api('/admin/settings', { token, method: 'PUT', body: payload }); setForm(normalizeSettings(data.settings)); onStoreChange(data.settings); setMessage('Configurações salvas e publicadas no cardápio.') } catch (reason) { setMessage(reason.message); setHasError(true) } finally { setSaving(false) } }
  return <form className="settings-manager" onSubmit={save}><div className="settings-heading"><div><span className="eyebrow">Personalização</span><h2>Configurações da loja</h2><p>Estas informações aparecem para seus clientes.</p></div><button className="primary-button" disabled={saving || Boolean(uploading)}><Save /> {saving ? 'Salvando...' : 'Salvar alterações'}</button></div>{message && <div className={`admin-alert ${hasError ? 'error' : 'success'}`}>{message}</div>}<div className="settings-grid"><div className="settings-column"><section className="admin-form-card"><div className="settings-section-title"><Sparkles /><div><h3>Identidade</h3><p>Nome, mensagem e imagens da loja.</p></div></div><label>Nome da loja<input value={form.store_name} onChange={(event) => set('store_name', event.target.value)} required /></label><label>Frase de apresentação<textarea value={form.tagline || ''} onChange={(event) => set('tagline', event.target.value)} rows="2" /></label><div className="brand-assets-grid"><BrandAssetUpload kind="logo" label="Logo" value={form.logo_url} uploading={uploading} onUpload={uploadAsset} /><BrandAssetUpload kind="banner" label="Banner" value={form.banner_url} uploading={uploading} onUpload={uploadAsset} /></div></section><section className="admin-form-card"><div className="settings-section-title"><Pencil /><div><h3>Conteúdo da vitrine</h3><p>Textos principais exibidos na página pública.</p></div></div><label>Selo de atendimento<input value={form.storefront_content.hero_badge || ''} onChange={(event) => nested('storefront_content', 'hero_badge', event.target.value)} placeholder="Estamos abertos" /></label><div className="field-grid"><label>Título principal<input value={form.storefront_content.hero_title || ''} onChange={(event) => nested('storefront_content', 'hero_title', event.target.value)} placeholder="Comida que abraça a" /></label><label>Destaque do título<input value={form.storefront_content.hero_highlight || ''} onChange={(event) => nested('storefront_content', 'hero_highlight', event.target.value)} placeholder="mesa." /></label></div><label>Texto sobre a foto<input value={form.storefront_content.hero_note || ''} onChange={(event) => nested('storefront_content', 'hero_note', event.target.value)} placeholder="feito com afeto ↗" /></label><label>Título do cardápio<input value={form.storefront_content.menu_title || ''} onChange={(event) => nested('storefront_content', 'menu_title', event.target.value)} /></label><label>Chamada da história<input value={form.storefront_content.story_eyebrow || ''} onChange={(event) => nested('storefront_content', 'story_eyebrow', event.target.value)} placeholder="Nossa cozinha" /></label><label>Título da história<input value={form.storefront_content.story_title || ''} onChange={(event) => nested('storefront_content', 'story_title', event.target.value)} /></label><label>História da loja<textarea value={form.storefront_content.story_text || ''} onChange={(event) => nested('storefront_content', 'story_text', event.target.value)} rows="4" /></label><label>Complemento da assinatura<input value={form.storefront_content.story_since || ''} onChange={(event) => nested('storefront_content', 'story_since', event.target.value)} placeholder="desde 2018" /></label></section><section className="admin-form-card"><div className="settings-section-title"><Palette /><div><h3>Aparência</h3><p>Cores aplicadas no cardápio.</p></div></div><div className="color-fields"><label>Cor principal<div><input type="color" value={form.primary_color} onChange={(event) => set('primary_color', event.target.value)} /><input value={form.primary_color} onChange={(event) => set('primary_color', event.target.value)} /></div></label><label>Cor de apoio<div><input type="color" value={form.accent_color} onChange={(event) => set('accent_color', event.target.value)} /><input value={form.accent_color} onChange={(event) => set('accent_color', event.target.value)} /></div></label></div><div className="theme-preview" style={{ '--preview-primary': form.primary_color, '--preview-accent': form.accent_color }}><span>Prévia da marca</span><h3>{form.store_name}</h3><button type="button">Fazer pedido</button></div></section></div><div className="settings-column"><section className="admin-form-card"><div className="settings-section-title"><Clock3 /><div><h3>Atendimento e entrega</h3><p>Modalidades, prazo e valores.</p></div></div><div className="toggle-grid"><label className="toggle-row"><input type="checkbox" checked={form.accepts_delivery} onChange={(event) => set('accepts_delivery', event.target.checked)} /><span><b>Entrega</b><small>Aceitar pedidos para entrega</small></span></label><label className="toggle-row"><input type="checkbox" checked={form.accepts_pickup} onChange={(event) => set('accepts_pickup', event.target.checked)} /><span><b>Retirada</b><small>Aceitar retirada no local</small></span></label></div><label className="toggle-row operational-pause-setting"><input type="checkbox" checked={form.is_paused} onChange={(event) => set('is_paused', event.target.checked)} /><span><b>Pausar novos pedidos</b><small>Use em imprevistos ou quando a cozinha estiver sobrecarregada.</small></span></label>{form.is_paused && <label>Mensagem da pausa<input value={form.pause_message || ''} onChange={(event) => set('pause_message', event.target.value)} placeholder="Voltamos em instantes." /></label>}<div className="field-grid"><label>Taxa padrão (R$)<input value={form.delivery_fee} onChange={(event) => set('delivery_fee', event.target.value)} /><small>Usada quando não houver bairros cadastrados.</small></label><label>Pedido mínimo (R$)<input value={form.minimum_order} onChange={(event) => set('minimum_order', event.target.value)} /></label></div><div className="delivery-zones-editor"><div className="delivery-zones-heading"><div><b>Área de entrega por bairro</b><small>Ao cadastrar bairros, entregas fora da lista serão bloqueadas.</small></div><button type="button" onClick={addDeliveryZone}><Plus /> Adicionar bairro</button></div>{form.delivery_zones.length === 0 ? <p>Nenhum bairro limitado. A taxa padrão vale para qualquer endereço.</p> : <div className="delivery-zone-list">{form.delivery_zones.map((zone, index) => <article key={`${index}-${zone.neighborhood}`}><label>Bairro<input value={zone.neighborhood} onChange={(event) => updateDeliveryZone(index, 'neighborhood', event.target.value)} placeholder="Centro" required /></label><label>Cidade<input value={zone.city || ''} onChange={(event) => updateDeliveryZone(index, 'city', event.target.value)} placeholder={form.address.city || 'Cidade'} /></label><label>UF<input maxLength="2" value={zone.state || ''} onChange={(event) => updateDeliveryZone(index, 'state', event.target.value.toUpperCase())} placeholder={form.address.state || 'UF'} /></label><label>Taxa (R$)<input value={zone.fee} onChange={(event) => updateDeliveryZone(index, 'fee', event.target.value)} placeholder="0,00" required /></label><button type="button" title="Remover bairro" onClick={() => removeDeliveryZone(index)}><Trash2 /></button></article>)}</div>}</div><div className="field-grid"><label>Prazo estimado (min)<input type="number" min="1" value={form.estimated_delivery_minutes} onChange={(event) => set('estimated_delivery_minutes', event.target.value)} /></label><label>Horário exibido<input value={form.business_hours.summary || ''} onChange={(event) => nested('business_hours', 'summary', event.target.value)} placeholder="Hoje, 18h às 23h" /></label></div><label className="toggle-row"><input type="checkbox" checked={form.enforce_business_hours} onChange={(event) => set('enforce_business_hours', event.target.checked)} /><span><b>Controlar pedidos pela grade semanal</b><small>Fora dos períodos abaixo, bloqueie ou agende o pedido.</small></span></label>{form.enforce_business_hours && <><label>Fora do horário<select value={form.outside_hours_mode || 'block'} onChange={(event) => set('outside_hours_mode', event.target.value)}><option value="block">Bloquear novos pedidos</option><option value="schedule">Agendar para a próxima abertura</option></select></label><BusinessHoursEditor value={form.business_hours} onChange={(hours) => set('business_hours', hours)} /></>}<label>Chave Pix<input value={form.pix_key || ''} onChange={(event) => set('pix_key', event.target.value)} placeholder="Telefone com +55, CPF/CNPJ, e-mail ou chave aleatória" /><small>Para celular, use o padrão internacional. Ex.: +5585999999999.</small></label></section><section className="admin-form-card"><div className="settings-section-title"><LayoutDashboard /><div><h3>Endereço</h3><p>Local da loja e referência para retirada.</p></div></div><div className="field-grid wide-first"><label>Rua<input value={form.address.street || ''} onChange={(event) => nested('address', 'street', event.target.value)} /></label><label>Número<input value={form.address.number || ''} onChange={(event) => nested('address', 'number', event.target.value)} /></label></div><div className="field-grid"><label>Cidade<input value={form.address.city || ''} onChange={(event) => nested('address', 'city', event.target.value)} /></label><label>Estado<input maxLength="2" value={form.address.state || ''} onChange={(event) => nested('address', 'state', event.target.value.toUpperCase())} /></label></div></section></div></div></form>
}

export default function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey) || '')
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem(userStorageKey) || 'null'))
  const [view, setView] = useState('menu'), [sidebar, setSidebar] = useState(false)
  const [store, setStore] = useState(null)
  const [operationError, setOperationError] = useState('')
  const [changingOperation, setChangingOperation] = useState(false)
  useEffect(() => {
    document.title = token
      ? `${store?.store_name || 'Painel administrativo'} · Triunfo Menu`
      : 'Entrar no painel · Triunfo Menu'
  }, [token, store?.store_name])
  useEffect(() => { let active = true; api('/storefront').then((data) => active && setStore(data.store)).catch(() => {}); return () => { active = false } }, [])
  useEffect(() => { if (!token) return undefined; let active = true; api('/admin/settings', { token }).then((data) => active && setStore(data.settings)).catch(() => {}); return () => { active = false } }, [token])
  useEffect(() => {
    const onUnauthorized = () => { localStorage.removeItem(tokenStorageKey); localStorage.removeItem(userStorageKey); setToken(''); setUser(null) }
    window.addEventListener('admin-unauthorized', onUnauthorized)
    return () => window.removeEventListener('admin-unauthorized', onUnauthorized)
  }, [])
  const navItems = [{ id: 'orders', icon: LayoutDashboard, label: 'Visão geral' }, { id: 'menu', icon: Menu, label: 'Cardápio' }, { id: 'site', icon: LayoutTemplate, label: 'Editor do site' }, { id: 'customers', icon: Users, label: 'Clientes' }, { id: 'settings', icon: Settings, label: 'Configurações' }]
  const titles = { orders: ['Operação da loja', 'Visão geral'], menu: ['Produtos e categorias', 'Seu cardápio'], site: ['Personalização sem código', 'Editor do site'], customers: ['Relacionamento', 'Gerência de clientes'], settings: ['Identidade e operação', 'Configurações'] }
  async function toggleStorePause() {
    if (!store || changingOperation) return
    setChangingOperation(true); setOperationError('')
    try {
      const data = await api('/admin/store/operational-status', { token, method: 'PATCH', body: { is_paused: !store.is_paused, pause_message: store.pause_message || null } })
      setStore(data.settings)
    } catch (reason) {
      setOperationError(reason.message)
    } finally {
      setChangingOperation(false)
    }
  }
  if (!token) return <AdminLogin store={store} onLogin={(data) => { localStorage.setItem(tokenStorageKey, data.token); localStorage.setItem(userStorageKey, JSON.stringify(data.user)); setToken(data.token); setUser(data.user) }} />
  const logout = () => { localStorage.removeItem(tokenStorageKey); localStorage.removeItem(userStorageKey); setToken(''); setUser(null) }
  const storeName = store?.store_name || 'Sua loja'
  return <div className="admin-shell"><aside className={`admin-sidebar ${sidebar ? 'open' : ''}`}><div className="sidebar-brand"><AdminBrand /><button className="icon-button sidebar-close" aria-label="Fechar menu do painel" onClick={() => setSidebar(false)}><X /></button></div><div className="restaurant-switcher"><span>{store?.logo_url ? <img src={store.logo_url} alt={`Logo de ${storeName}`} /> : <Store aria-hidden="true" />}</span><div><b>{storeName}</b><small>Loja atual</small></div><ChevronRight /></div><nav>{navItems.map(({ id, icon: Icon, label, disabled }) => <button className={view === id ? 'active' : ''} disabled={disabled} onClick={() => { if (!disabled) { setView(id); setSidebar(false) } }} key={id}><Icon /><span>{label}</span>{disabled && <small>breve</small>}</button>)}</nav><div className="sidebar-bottom"><a href={tenantUrl('/')}>← Ver minha loja</a><div className="admin-profile"><span>{user?.name?.[0] || 'U'}</span><div><b>{user?.name || 'Usuário'}</b><small>Equipe da loja</small></div><button title="Sair" onClick={logout}><LogOut /></button></div></div></aside><main className="admin-main"><header className="admin-header"><button className="icon-button menu-toggle" aria-label="Abrir menu do painel" onClick={() => setSidebar(true)}><Menu /></button><div><span className="eyebrow">{titles[view]?.[0]}</span><h1>{titles[view]?.[1]}</h1></div><div className="header-actions"><button type="button" className={`store-pause-toggle ${store?.is_paused ? 'paused' : ''}`} disabled={!store || changingOperation} onClick={toggleStorePause}><Power /> {changingOperation ? 'Atualizando...' : store?.is_paused ? 'Retomar pedidos' : 'Pausar loja'}</button><span className={`store-status ${store?.is_paused ? 'paused' : ''}`}><i /> {store?.is_paused ? 'Loja pausada' : store?.business_hours?.summary || 'Loja configurada'}</span></div></header><div className="admin-view">{operationError && <div className="admin-alert error">{operationError}</div>}<div hidden={view !== 'orders'}><OrdersView token={token} store={store} /></div>{view === 'menu' && <MenuManager token={token} />}{view === 'site' && <SiteEditor token={token} onStoreChange={setStore} />}{view === 'customers' && <CustomersView token={token} />}{view === 'settings' && <SettingsManager token={token} onStoreChange={setStore} />}</div></main></div>
}
