import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bell, Bike, Check, ChevronRight, Clock3, Copy, CreditCard,
  LayoutDashboard, MapPin, Menu, Minus, PackageCheck, Plus, Power, Search, Settings,
  ShoppingBag, Sparkles, Truck, Users, X,
} from 'lucide-react'
import './App.css'
import AdminApp from './AdminApp'
import { tenantHeaders, tenantUrl } from './tenant'
import { mergeDesign } from './storefrontDesign'
import QRCode from 'qrcode'
import { buildPixPayload } from './pix'

const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
const normalizePhone = (value) => {
  const digits = value.replace(/\D/g, '')
  return digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits
}
const normalizeLocation = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
const deliveryZones = (store) => (store.delivery_zones || []).filter((zone) => zone.active !== false && zone.neighborhood)
const deliveryZoneKey = (zone) => `${normalizeLocation(zone?.city)}|${String(zone?.state || '').toUpperCase()}|${normalizeLocation(zone?.neighborhood)}`
const deliveryZoneFor = (store, address) => deliveryZones(store).find((zone) => (
  normalizeLocation(zone.neighborhood) === normalizeLocation(address.neighborhood)
  && (!zone.city || normalizeLocation(zone.city) === normalizeLocation(address.city))
  && (!zone.state || zone.state.toUpperCase() === String(address.state || '').toUpperCase())
))
const startingDeliveryFee = (store) => {
  const zones = deliveryZones(store)
  return zones.length > 0 ? Math.min(...zones.map((zone) => Number(zone.fee_cents))) : store.delivery_fee_cents
}
const operationDate = (value) => value ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : ''

/* Legacy demo data intentionally disabled:
const _fallbackData = {
  categories: [
    { id: 'cat-bebidas', name: 'Bebidas', slug: 'bebidas', products: [
      { id: 'bebida-1', name: 'Limonada siciliana', description: 'Limão siciliano, água com gás e xarope da casa. 500 ml.', price_cents: 1490, image_url: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9d?auto=format&fit=crop&w=900&q=85' },
    ] },
  ],
}
*/

function Brand({ store, compact = false }) {
  const name = store?.store_name || 'Sua loja'
  const parts = name.trim().split(/\s+/)
  const highlight = parts.length > 1 ? parts.pop() : parts[0]
  const prefix = parts.length > 0 ? `${parts.join(' ')} ` : ''
  return <div className={`brand ${compact ? 'compact' : ''}`}>{store?.logo_url ? <span className="brand-logo"><img src={store.logo_url} alt={`Logo de ${name}`} /></span> : <span className="brand-mark"><Sparkles size={18} /></span>}<span>{prefix}<strong>{highlight}</strong></span></div>
}

function ProductModal({ product, onClose, onAdd }) {
  const variants = product?.variants || []
  const groups = product?.modifier_groups || []
  const [variantId, setVariantId] = useState(variants[0]?.id || null)
  const [selectedExtras, setSelectedExtras] = useState([])
  const [quantity, setQuantity] = useState(1)

  if (!product) return null
  const variant = variants.find((item) => item.id === variantId)
  const availableExtras = groups.flatMap((group) => group.options || [])
  const total = (product.price_cents + (variant?.price_delta_cents || 0) + availableExtras.filter((item) => selectedExtras.includes(item.id)).reduce((sum, item) => sum + item.price_cents, 0)) * quantity
  const toggleExtra = (group, id) => setSelectedExtras((current) => {
    if (current.includes(id)) return current.filter((item) => item !== id)

    const groupOptionIds = new Set((group.options || []).map((item) => item.id))
    const selectedInGroup = current.filter((item) => groupOptionIds.has(item)).length
    const maxChoices = Number(group.max_choices) || 2

    return selectedInGroup < maxChoices ? [...current, id] : current
  })

  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`product-modal${product.image_url ? '' : ' no-image'}`}>
      <button className="icon-button close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
      {product.image_url && <div className="modal-photo" style={{ backgroundImage: `url(${product.image_url})` }} />}
      <div className="modal-content">
        <span className="eyebrow">{product.category}</span><h2>{product.name}</h2><p>{product.description}</p>
        {variants.length > 0 && <div className="option-block"><div className="option-heading"><div><strong>Escolha o tamanho</strong><small>Obrigatório</small></div><span>1 opção</span></div>
          {variants.map((item) => <label className="option-row" key={item.id}><input type="radio" name="variant" checked={variantId === item.id} onChange={() => setVariantId(item.id)} /><span>{item.name}</span><b>{item.price_delta_cents ? `+ ${money(item.price_delta_cents)}` : 'Incluso'}</b></label>)}
        </div>}
        {groups.map((group) => <div className="option-block" key={group.id}><div className="option-heading"><div><strong>{group.name}</strong><small>Opcional</small></div><span>Até {group.max_choices || 2}</span></div>
          {(group.options || []).map((item) => <label className="option-row" key={item.id}><input type="checkbox" checked={selectedExtras.includes(item.id)} onChange={() => toggleExtra(group, item.id)} /><span>{item.name}</span><b>+ {money(item.price_cents)}</b></label>)}
        </div>)}
        <div className="modal-footer"><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><strong>{quantity}</strong><button onClick={() => setQuantity(quantity + 1)}><Plus size={16} /></button></div><button className="primary-button grow" onClick={() => { onAdd({ product, variant, options: availableExtras.filter((item) => selectedExtras.includes(item.id)), quantity, unitPrice: total / quantity }); onClose() }}>Adicionar <span>{money(total)}</span></button></div>
      </div>
    </section>
  </div>
}

function CartDrawer({ items, store, operation, onClose, onQuantity, onCheckout }) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  return <div className="overlay drawer-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="cart-drawer">
    <div className="drawer-header"><div><span className="eyebrow">Seu pedido</span><h2>Cesta</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
    {items.length === 0 ? <div className="empty-cart"><ShoppingBag size={40} /><h3>Sua cesta está vazia</h3><p>Escolha algo gostoso no cardápio.</p><button className="secondary-button" onClick={onClose}>Ver cardápio</button></div> : <>
      <div className="cart-items">{items.map((item, index) => <article className="cart-item" key={item.key}><img src={item.product.image_url} alt="" /><div><strong>{item.product.name}</strong><small>{item.variant?.name || 'Tamanho único'}</small>{item.options.length > 0 && <small>{item.options.map((option) => option.name).join(', ')}</small>}<b>{money(item.unitPrice)}</b></div><div className="mini-quantity"><button onClick={() => onQuantity(index, -1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => onQuantity(index, 1)}><Plus size={13} /></button></div></article>)}</div>
      <div className="cart-summary"><div className="total"><span>Subtotal</span><b>{money(subtotal)}</b></div><small>Pedido mínimo de {money(store.minimum_order_cents)}.{store.accepts_delivery ? ' A taxa de entrega será calculada no checkout.' : ''}</small></div>
      {operation.state !== 'open' && <div className={`cart-operation-message ${operation.accepting_orders ? 'scheduled' : 'blocked'}`}><Clock3 /><span><b>{operation.accepting_orders ? 'Pedido será agendado' : 'Pedidos indisponíveis'}</b><small>{operation.message}</small></span></div>}
      <button className="primary-button checkout-button" disabled={subtotal < store.minimum_order_cents || !operation.accepting_orders} onClick={onCheckout}>{!operation.accepting_orders ? 'Pedidos indisponíveis' : operation.will_schedule ? 'Agendar pedido' : 'Continuar pedido'} <ArrowRight size={18} /></button>
    </>}
  </aside></div>
}

function Checkout({ items, store, plan, operation, onBack, onSuccess }) {
  const pixEnabled = Boolean(store.pix_key) && plan?.features?.includes('manual_pix')
  const zones = deliveryZones(store)
  const [fulfillment, setFulfillment] = useState(store.accepts_delivery ? 'delivery' : 'pickup')
  const [payment, setPayment] = useState(pixEnabled ? 'pix' : 'card_on_delivery')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [phone, setPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('new')
  const [addressLookup, setAddressLookup] = useState('idle')
  const [address, setAddress] = useState({ label: 'Principal', street: '', number: '', complement: '', neighborhood: '', city: store.address?.city || '', state: store.address?.state || 'SP', postal_code: '', reference: '' })
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const servedCities = Array.from(zones.reduce((cities, zone) => {
    const key = `${normalizeLocation(zone.city)}|${String(zone.state || '').toUpperCase()}`
    if (zone.city && !cities.has(key)) cities.set(key, { key, city: zone.city, state: String(zone.state || '').toUpperCase() })
    return cities
  }, new Map()).values()).sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'))
  const selectedCity = servedCities.find((item) => (
    normalizeLocation(item.city) === normalizeLocation(address.city)
    && (!address.state || item.state === String(address.state).toUpperCase())
  )) || servedCities.find((item) => normalizeLocation(item.city) === normalizeLocation(address.city))
  const servedNeighborhoods = selectedCity ? zones.filter((zone) => (
    normalizeLocation(zone.city) === normalizeLocation(selectedCity.city)
    && String(zone.state || '').toUpperCase() === selectedCity.state
  )).sort((a, b) => a.neighborhood.localeCompare(b.neighborhood, 'pt-BR')) : []
  const matchedDeliveryZone = deliveryZoneFor(store, address)
  const deliveryFee = fulfillment === 'delivery' ? (zones.length > 0 ? matchedDeliveryZone?.fee_cents || 0 : store.delivery_fee_cents) : 0
  const addressCoverageChecked = address.neighborhood.trim().length >= 2
  const outsideDeliveryArea = fulfillment === 'delivery' && zones.length > 0 && addressCoverageChecked && !matchedDeliveryZone
  const total = subtotal + deliveryFee

  useEffect(() => {
    const normalized = normalizePhone(phone)
    if (normalized.length < 10 || normalized.length > 11) {
      return undefined
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setAddressLookup('loading')
      try {
        const response = await fetch(`/api/customers/addresses?phone=${encodeURIComponent(phone)}`, { headers: tenantHeaders, signal: controller.signal })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Não foi possível consultar seus endereços.')
        const found = result.addresses || []
        setSavedAddresses(found)
        if (result.customer?.name) setCustomerName((current) => current || result.customer.name)
        if (found.length > 0) {
          setSelectedAddressId(found[0].id)
          setAddress({ ...found[0], complement: found[0].complement || '', reference: found[0].reference || '' })
        }
        setAddressLookup('done')
      } catch (reason) {
        if (reason.name !== 'AbortError') setAddressLookup('error')
      }
    }, 550)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [phone])

  const updatePhone = (value) => {
    const previous = normalizePhone(phone)
    const normalized = normalizePhone(value)
    setPhone(value)
    if (normalized !== previous) {
      setSavedAddresses([])
      setSelectedAddressId('new')
      setAddress({ label: 'Principal', street: '', number: '', complement: '', neighborhood: '', city: store.address?.city || '', state: store.address?.state || 'SP', postal_code: '', reference: '' })
    }
    if (normalized.length < 10 || normalized.length > 11) {
      setAddressLookup('idle')
    }
  }

  const chooseAddress = (saved) => {
    const canonicalZone = zones.find((zone) => (
      normalizeLocation(zone.neighborhood) === normalizeLocation(saved.neighborhood)
      && normalizeLocation(zone.city) === normalizeLocation(saved.city)
    ))
    setSelectedAddressId(saved.id)
    setAddress({
      ...saved,
      ...(canonicalZone ? { neighborhood: canonicalZone.neighborhood, city: canonicalZone.city, state: canonicalZone.state } : {}),
      complement: saved.complement || '',
      reference: saved.reference || '',
    })
  }

  const useNewAddress = () => {
    setSelectedAddressId('new')
    setAddress({ label: 'Principal', street: '', number: '', complement: '', neighborhood: '', city: store.address?.city || '', state: store.address?.state || 'SP', postal_code: '', reference: '' })
  }

  const updateAddress = (field, value) => {
    setSelectedAddressId('new')
    setAddress((current) => ({ ...current, [field]: value }))
  }

  const updateDeliveryCity = (key) => {
    const city = servedCities.find((item) => item.key === key)
    setSelectedAddressId('new')
    setAddress((current) => ({ ...current, city: city?.city || '', state: city?.state || '', neighborhood: '' }))
  }

  const updateDeliveryNeighborhood = (zoneId) => {
    const zone = zones.find((item) => deliveryZoneKey(item) === zoneId)
    setSelectedAddressId('new')
    setAddress((current) => ({
      ...current,
      neighborhood: zone?.neighborhood || '',
      city: zone?.city || current.city,
      state: zone?.state || current.state,
    }))
  }

  async function submit(event) {
    event.preventDefault()
    if (outsideDeliveryArea || (fulfillment === 'delivery' && zones.length > 0 && !matchedDeliveryZone)) {
      setError('Este endereço está fora da área de entrega da loja.')
      return
    }
    setSending(true); setError('')
    const form = new FormData(event.currentTarget)
    const payload = {
      customer: { name: customerName, phone, email: customerEmail || null }, fulfillment_type: fulfillment, payment_method: payment,
      delivery_address: fulfillment === 'delivery' ? address : null,
      notes: form.get('notes') || null,
      items: items.map((item) => ({ product_id: item.product.id, variant_id: item.variant?.id || null, modifier_option_ids: item.options.map((option) => option.id), quantity: item.quantity })),
    }
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { ...tenantHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) })
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Não foi possível enviar o pedido.'); onSuccess(result.order)
    } catch (reason) { setError(reason.message) } finally { setSending(false) }
  }

  return <main className="checkout-page"><header className="simple-header"><Brand store={store} /><button className="text-button" onClick={onBack}><ArrowLeft size={17} /> Voltar ao cardápio</button></header>
    <form className="checkout-grid" onSubmit={submit}><section className="checkout-form"><span className="eyebrow">Último passo</span><h1>Como você quer receber?</h1>
      {operation.will_schedule && <div className="checkout-operation-note"><Clock3 /><div><b>Pedido agendado</b><p>{operation.message}{operation.scheduled_for ? ` Previsão de abertura: ${operationDate(operation.scheduled_for)}.` : ''}</p></div></div>}
      <div className="choice-grid">{store.accepts_delivery && <button type="button" className={fulfillment === 'delivery' ? 'choice active' : 'choice'} onClick={() => setFulfillment('delivery')}><Bike /><span><b>Entrega</b><small>Em cerca de {store.estimated_delivery_minutes} min</small></span><Check /></button>}{store.accepts_pickup && <button type="button" className={fulfillment === 'pickup' ? 'choice active' : 'choice'} onClick={() => setFulfillment('pickup')}><ShoppingBag /><span><b>Retirada</b><small>Retire no endereço da loja</small></span><Check /></button>}</div>
      <div className="form-card"><h3>Seus dados</h3><div className="field-grid"><label>Telefone ou WhatsApp<input name="phone" type="tel" required value={phone} onChange={(event) => updatePhone(event.target.value)} placeholder="(11) 99999-9999" /></label><label>Nome completo<input name="name" required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Como podemos chamar você?" /></label></div><label>E-mail <small>(opcional)</small><input name="email" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="voce@email.com" /></label>{addressLookup === 'loading' && <small className="lookup-message">Buscando seus endereços...</small>}</div>
      {fulfillment === 'delivery' && <div className="form-card"><div className="address-heading"><div><h3>Endereço de entrega</h3>{savedAddresses.length > 0 && <p>Encontramos endereços usados anteriormente. Escolha um ou cadastre outro.</p>}</div>{savedAddresses.length > 0 && <button type="button" onClick={useNewAddress}>+ Novo endereço</button>}</div>{savedAddresses.length > 0 && <div className="saved-addresses">{savedAddresses.map((saved) => <button type="button" className={selectedAddressId === saved.id ? 'saved-address active' : 'saved-address'} key={saved.id} onClick={() => chooseAddress(saved)}><MapPin size={18} /><span><b>{saved.label}</b><small>{saved.street}, {saved.number} · {saved.neighborhood}</small></span><Check size={16} /></button>)}</div>}<div className="field-grid wide-first"><label>Rua<input name="street" required value={address.street} onChange={(event) => updateAddress('street', event.target.value)} placeholder="Rua, avenida..." /></label><label>Número<input name="number" required value={address.number} onChange={(event) => updateAddress('number', event.target.value)} placeholder="123" /></label></div><div className="field-grid"><label>Complemento <small>(opcional)</small><input name="complement" value={address.complement} onChange={(event) => updateAddress('complement', event.target.value)} /></label><label>Cidade<select name="city" required value={selectedCity?.key || ''} onChange={(event) => updateDeliveryCity(event.target.value)}><option value="" disabled>Selecione a cidade</option>{servedCities.map((item) => <option value={item.key} key={item.key}>{item.city}{item.state ? ` — ${item.state}` : ''}</option>)}</select></label></div><div className="field-grid"><label>Bairro<select name="neighborhood" required disabled={!selectedCity} value={matchedDeliveryZone ? deliveryZoneKey(matchedDeliveryZone) : ''} onChange={(event) => updateDeliveryNeighborhood(event.target.value)}><option value="" disabled>{selectedCity ? 'Selecione o bairro' : 'Escolha a cidade primeiro'}</option>{servedNeighborhoods.map((zone) => { const key = deliveryZoneKey(zone); return <option value={key} key={key}>{zone.neighborhood}</option> })}</select></label><label>CEP<input name="postal_code" required value={address.postal_code} onChange={(event) => updateAddress('postal_code', event.target.value)} placeholder="00000-000" /></label></div>{zones.length > 0 && addressCoverageChecked && <div className={`delivery-coverage ${matchedDeliveryZone ? 'covered' : 'outside'}`}>{matchedDeliveryZone ? <><Check /><span><b>Entrega disponível</b><small>Taxa para {matchedDeliveryZone.neighborhood}: {money(matchedDeliveryZone.fee_cents)}</small></span></> : <><X /><span><b>Fora da área de entrega</b><small>Escolha uma cidade e um bairro atendidos.</small></span></>}</div>}<label>Ponto de referência <small>(opcional)</small><input name="reference" value={address.reference} onChange={(event) => updateAddress('reference', event.target.value)} /></label></div>}
      <div className="form-card"><h3>Pagamento direto à loja</h3><div className="payment-options">{pixEnabled && <button type="button" className={payment === 'pix' ? 'payment active' : 'payment'} onClick={() => setPayment('pix')}><span className="pix-icon">◇</span><span><b>Pix</b><small>Chave exibida após o pedido</small></span><Check /></button>}<button type="button" className={payment === 'card_on_delivery' ? 'payment active' : 'payment'} onClick={() => setPayment('card_on_delivery')}><CreditCard /><span><b>Cartão na entrega</b><small>Crédito ou débito</small></span><Check /></button><button type="button" className={payment === 'cash' ? 'payment active' : 'payment'} onClick={() => setPayment('cash')}><span className="cash-icon">$</span><span><b>Dinheiro</b><small>Pague ao receber</small></span><Check /></button></div></div>
      <div className="form-card"><label>Observações do pedido<textarea name="notes" rows="3" placeholder="Ex.: sem cebola, interfone não funciona..." /></label></div>
    </section><aside className="order-review"><span className="eyebrow">Resumo</span><h2>Seu pedido</h2>{items.map((item) => <div className="review-item" key={item.key}><span>{item.quantity}×</span><div><b>{item.product.name}</b><small>{item.variant?.name}</small></div><strong>{money(item.unitPrice * item.quantity)}</strong></div>)}<div className="review-totals"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>{fulfillment === 'delivery' ? 'Entrega' : 'Retirada'}</span><b>{fulfillment === 'delivery' ? (zones.length > 0 && !matchedDeliveryZone ? 'A calcular' : money(deliveryFee)) : 'Grátis'}</b></div><div className="total"><span>Total</span><b>{money(total)}</b></div></div>{operation.will_schedule && <small className="scheduled-review"><Clock3 /> Agendado para {operationDate(operation.scheduled_for)}</small>}{error && <p className="error-message">{error}</p>}<button className="primary-button checkout-button" disabled={sending || !operation.accepting_orders || (fulfillment === 'delivery' && zones.length > 0 && !matchedDeliveryZone)}>{sending ? 'Enviando...' : <>{operation.will_schedule ? 'Agendar pedido' : 'Fazer pedido'} <span>{money(total)}</span></>}</button><small className="secure-note"><Check size={14} /> Valores conferidos novamente pelo servidor</small></aside></form>
  </main>
}

function Success({ order: initialOrder, store, onReset }) {
  const [order, setOrder] = useState(initialOrder)
  const [copied, setCopied] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const pixPayload = useMemo(() => {
    if (order.payment_method !== 'pix' || !store.pix_key) return ''
    try {
      return buildPixPayload({
        key: store.pix_key,
        amountCents: order.total_cents,
        merchantName: store.store_name,
        merchantCity: store.address?.city,
        txid: `PEDIDO${order.number}`,
      })
    } catch {
      return ''
    }
  }, [order, store])

  useEffect(() => {
    let active = true
    if (!pixPayload) return undefined
    QRCode.toDataURL(pixPayload, { errorCorrectionLevel: 'M', margin: 2, width: 280, color: { dark: '#102f23', light: '#ffffff' } })
      .then((url) => { if (active) setQrCode(url) })
      .catch(() => { if (active) setQrCode('') })
    return () => { active = false }
  }, [pixPayload])

  useEffect(() => {
    let active = true
    let requestRunning = false
    const refresh = async () => {
      if (requestRunning) return
      requestRunning = true
      try {
        const response = await fetch(`/api/orders/${initialOrder.public_id}`, { headers: tenantHeaders })
        const result = await response.json()
        if (response.ok && active) setOrder(result.order)
      } catch {
        // A próxima atualização tenta novamente sem interromper a confirmação exibida.
      } finally {
        requestRunning = false
      }
    }
    const interval = window.setInterval(refresh, 8000)
    refresh()
    return () => { active = false; window.clearInterval(interval) }
  }, [initialOrder.public_id])

  const copyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  const pixPending = order.payment_method === 'pix' && order.payment_status === 'pending'
  const pixPaid = order.payment_method === 'pix' && order.payment_status === 'paid'
  const pixUnavailable = order.payment_method === 'pix' && ['failed', 'expired'].includes(order.payment_status)
  const productionStarted = ['preparing', 'ready', 'out_for_delivery', 'completed'].includes(order.status)
  const scheduled = Boolean(order.scheduled_for)

  return <main className="success-page"><div className="success-card"><span className={`success-icon${pixPending ? ' payment-pending' : pixUnavailable ? ' payment-failed' : ''}`}>{pixPending || scheduled ? <Clock3 /> : pixUnavailable ? <X /> : <Check />}</span><span className="eyebrow">Pedido #{order.number}</span><h1>{pixPending ? 'Aguardando seu Pix' : pixUnavailable ? 'Pagamento não confirmado' : scheduled ? 'Pedido agendado!' : 'Recebemos seu pedido!'}</h1><p>{pixPending ? 'Faça o pagamento abaixo. A loja confirmará o recebimento antes de iniciar o preparo.' : pixPaid ? 'Pagamento confirmado. Agora a loja pode preparar seu pedido.' : pixUnavailable ? 'Entre em contato com a loja para verificar o pagamento do pedido.' : scheduled ? `Seu pedido ficou agendado para ${operationDate(order.scheduled_for)}.` : 'Você pode acompanhar cada etapa por aqui.'}</p>{scheduled && <div className="customer-payment-state scheduled"><Clock3 /><div><b>Próxima abertura</b><small>{operationDate(order.scheduled_for)}</small></div></div>}{pixPayload && pixPending && <div className="pix-payment-card"><span>Pagamento via Pix · aguardando</span><strong>{money(order.total_cents)}</strong><p>Escaneie o QR Code no aplicativo do banco ou use o Pix copia e cola.</p><div className="pix-payment-layout"><div className="pix-qr-code">{qrCode ? <img src={qrCode} alt={`QR Code Pix do pedido ${order.number}`} /> : <span className="loading-spinner" />}<small>Abra o app do banco e escolha pagar com QR Code.</small></div><div className="pix-copy-block"><b>Pix copia e cola</b><code>{pixPayload}</code><button type="button" onClick={copyPixKey}><Copy size={16} /> {copied ? 'Código copiado' : 'Copiar código Pix'}</button><small>Chave: {store.pix_key}</small></div></div></div>}{pixPaid && <div className="customer-payment-state paid"><Check /><div><b>Pagamento Pix confirmado</b><small>A confirmação foi registrada pela loja.</small></div></div>}{pixUnavailable && <div className="customer-payment-state failed"><X /><div><b>Pagamento {order.payment_status === 'expired' ? 'expirado' : 'recusado'}</b><small>Entre em contato com a loja para combinar outra forma de pagamento.</small></div></div>}<div className="timeline"><div className="done"><span /><div><b>{scheduled ? 'Pedido agendado' : 'Pedido recebido'}</b><small>{scheduled ? operationDate(order.scheduled_for) : 'Agora'}</small></div></div>{order.payment_method === 'pix' && <div className={pixPaid ? 'done' : ''}><span /><div><b>{pixPaid ? 'Pagamento confirmado' : pixUnavailable ? `Pagamento ${order.payment_status === 'expired' ? 'expirado' : 'recusado'}` : 'Aguardando confirmação do Pix'}</b><small>{pixPaid ? 'Recebimento confirmado pela loja' : pixUnavailable ? 'Fale com a loja para regularizar' : 'Atualização automática a cada 8 segundos'}</small></div></div>}<div className={productionStarted ? 'done' : ''}><span /><div><b>Preparando com carinho</b><small>{productionStarted ? 'A cozinha iniciou o pedido' : pixUnavailable ? 'Aguardando regularização do pagamento' : scheduled ? 'Na abertura da loja' : 'Após a confirmação'}</small></div></div></div><button className="primary-button" onClick={onReset}>Voltar ao cardápio</button><small>ID do pedido: {order.public_id}</small></div></main>
}

const previewMode = new URLSearchParams(window.location.search).get('preview') === '1'

function Storefront() {
  const [data, setData] = useState(null), [loadError, setLoadError] = useState(''), [search, setSearch] = useState(''), [selected, setSelected] = useState(null), [cartOpen, setCartOpen] = useState(false), [cart, setCart] = useState([]), [view, setView] = useState('menu'), [order, setOrder] = useState(null)
  const [override, setOverride] = useState(null)
  useEffect(() => {
    let active = true
    const load = () => fetch('/api/storefront', { headers: tenantHeaders })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message || 'Loja não encontrada.'); return payload })
      .then((payload) => { if (active) { setData(payload); setLoadError(''); document.title = `${payload.store.store_name} · Cardápio e pedidos` } })
      .catch((reason) => active && setLoadError(reason.message || 'Não foi possível carregar esta loja.'))
    load()
    if (previewMode) return () => { active = false }
    const interval = window.setInterval(load, 60000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])
  useEffect(() => {
    if (!previewMode) return undefined
    const onMessage = (event) => { if (event.data?.type === 'cardapio-preview') setOverride(event.data.payload || {}) }
    window.addEventListener('message', onMessage)
    window.parent?.postMessage({ type: 'cardapio-preview-ready' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])
  const products = useMemo(() => (data?.categories || []).flatMap((category) => category.products.map((product) => ({ ...product, category: category.name }))).filter((product) => `${product.name} ${product.description || ''}`.toLowerCase().includes(search.toLowerCase())), [data, search])
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0), cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const updateQuantity = (index, delta) => setCart((current) => current.flatMap((item, itemIndex) => itemIndex !== index ? [item] : item.quantity + delta > 0 ? [{ ...item, quantity: item.quantity + delta }] : []))
  if (loadError) return <main className="store-load-state"><div><Sparkles /><h1>Não foi possível carregar a loja</h1><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Tentar novamente</button></div></main>
  if (!data) return <main className="store-load-state"><div><span className="loading-spinner" /><p>Carregando a loja...</p></div></main>
  const operation = data.operation || { state: 'open', accepting_orders: true, will_schedule: false, scheduled_for: null, message: '' }
  if (view === 'checkout') return <Checkout items={cart} store={data.store} plan={data.plan} operation={operation} onBack={() => setView('menu')} onSuccess={(created) => { setOrder(created); setView('success'); setCart([]) }} />
  if (view === 'success') return <Success order={order} store={data.store} onReset={() => setView('menu')} />
  const store = override ? { ...data.store, ...override } : data.store
  const content = store.storefront_content || {}
  const design = mergeDesign(store.storefront_design)
  const address = store.address || {}
  const addressLine = [address.street, address.number].filter(Boolean).join(', ')
  const locationLine = [address.city, address.state].filter(Boolean).join(', ')
  const heroImage = store.banner_url || 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1100&q=90'
  const storyImageStyle = design.story_image_url ? { backgroundImage: `url(${design.story_image_url})` } : undefined
  const sectionNodes = {
    hero: design.sections.hero && <section className={`hero-section hero-${design.hero_layout}`} key="hero"><div className="hero-copy"><span className={`open-pill ${operation.state !== 'open' ? 'closed' : ''}`}><i /> {operation.state === 'open' ? (content.hero_badge || store.business_hours?.summary || 'Cardápio disponível') : operation.state === 'paused' ? 'Loja pausada' : operation.will_schedule ? 'Aceitando agendamentos' : 'Loja fechada'}</span><h1>{content.hero_title || 'Sabor feito para'}<br /><em>{content.hero_highlight || 'você.'}</em></h1><p>{store.tagline}</p><div className="hero-actions"><a className="primary-button" href="#cardapio">Ver cardápio <ArrowRight size={18} /></a>{store.accepts_delivery && <div><Clock3 size={18} /><span><b>Até {store.estimated_delivery_minutes} min</b><small>Tempo estimado</small></span></div>}</div></div><div className="hero-visual"><div className="arch-photo" style={{ backgroundImage: `linear-gradient(20deg,rgba(14,42,31,.16),transparent 55%),url(${heroImage})` }} /><div className="floating-card"><span className="avatar-stack"><i /><i /><i /></span><div><b>{store.store_name}</b><small>{products.filter((product) => !product.is_sold_out).length} opções disponíveis</small></div></div><span className="handwritten">{content.hero_note || 'feito com carinho ↗'}</span></div></section>,
    services: design.sections.services && <section className="service-strip" key="services"><div><Truck /><span><b>{store.accepts_delivery ? 'Entrega disponível' : 'Pedidos para retirada'}</b><small>{store.accepts_delivery ? `${store.estimated_delivery_minutes} min · a partir de ${money(startingDeliveryFee(store))}` : 'Retire diretamente na loja'}</small></span></div><div><Clock3 /><span><b>Horário da loja</b><small>{store.business_hours?.summary || 'Consulte o atendimento'}</small></span></div><div><MapPin /><span><b>{locationLine || 'Local da loja'}</b><small>{addressLine || 'Endereço não informado'}</small></span></div></section>,
    menu: <main id="cardapio" className="menu-section" key="menu"><div className="section-heading"><div><span className="eyebrow">Nosso cardápio</span><h2>{content.menu_title || 'Escolha o seu favorito'}</h2></div><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no cardápio" /></label></div><div className="category-tabs">{data.categories.map((category, index) => <a className={index === 0 ? 'active' : ''} href={`#${category.slug}`} key={category.id}>{category.name}</a>)}</div>
      {data.categories.map((category) => { const visible = products.filter((product) => product.category === category.name); return visible.length > 0 && <section className="category-section" id={category.slug} key={category.id}><div className="category-title"><h3>{category.name}</h3><span>{visible.length} opções</span></div><div className={`product-grid cards-${design.card_layout}`}>{visible.map((product) => <article className={`product-card${product.image_url ? '' : ' no-image'}${product.is_sold_out ? ' sold-out' : ''}`} key={product.id} onClick={() => !product.is_sold_out && setSelected(product)} aria-disabled={product.is_sold_out}>{product.image_url && <div className="product-image" style={{ backgroundImage: `url(${product.image_url})` }}>{product.is_sold_out ? <span className="sold-out-badge">Esgotado</span> : <button aria-label="Adicionar"><Plus size={20} /></button>}</div>}<div className="product-copy"><span>{product.is_sold_out ? 'Esgotado' : product.category}</span><h4>{product.name}</h4><p>{product.description}</p><div><b>{product.is_sold_out ? 'Indisponível no momento' : `A partir de ${money(product.price_cents)}`}</b>{!product.is_sold_out && <ChevronRight size={18} />}</div></div></article>)}</div></section> })}
    </main>,
    story: design.sections.story && <section id="sobre" className="story-section" key="story"><div className="story-photo" style={storyImageStyle} /><div><span className="eyebrow">{content.story_eyebrow || 'Nossa história'}</span><h2>{content.story_title || `Conheça ${store.store_name}.`}</h2><p>{content.story_text || store.tagline}</p><div className="signature">{store.store_name} {content.story_since && <small>{content.story_since}</small>}</div></div></section>,
  }
  return <div className={`storefront corners-${design.corner_style}${previewMode ? ' preview-mode' : ''}`} style={{ '--primary': store.primary_color, '--accent': store.accent_color, '--cream': design.background_color, '--paper': design.surface_color, '--ink': design.text_color }}>
    <header className="store-header"><Brand store={store} /><nav><a href="#cardapio">Cardápio</a><a href="#sobre">Nossa história</a><a href={tenantUrl('/admin')}>Área da loja</a></nav></header>
    <button className="cart-button" onClick={() => setCartOpen(true)}><ShoppingBag size={18} /><span>Cesta</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
    {operation.state !== 'open' && <div className={`store-operation-banner ${operation.accepting_orders ? 'scheduled' : 'blocked'}`}><span>{operation.state === 'paused' ? <Power /> : <Clock3 />}</span><div><b>{operation.state === 'paused' ? 'Loja pausada temporariamente' : operation.will_schedule ? 'Loja fechada · pedidos agendados' : 'Loja fechada'}</b><p>{operation.message}{operation.scheduled_for ? ` Próxima abertura: ${operationDate(operation.scheduled_for)}.` : ''}</p></div></div>}
    {design.section_order.map((key) => sectionNodes[key])}
    {design.sections.footer && <footer><Brand store={store} compact /><p>{[addressLine, locationLine].filter(Boolean).join(' · ') || 'Endereço não informado'}</p><div><span>{store.business_hours?.summary}</span><a href={tenantUrl('/admin')}>Painel da loja</a></div></footer>}
    {cartCount > 0 && <button className="mobile-cart-bar" onClick={() => setCartOpen(true)}><span><ShoppingBag size={18} /> {cartCount} {cartCount === 1 ? 'item' : 'itens'}</span><b>Ver cesta · {money(cartTotal)}</b></button>}
    {selected && <ProductModal product={selected} onClose={() => setSelected(null)} onAdd={(item) => setCart((current) => [...current, { ...item, key: crypto.randomUUID() }])} />}
    {cartOpen && <CartDrawer items={cart} store={store} operation={operation} onClose={() => setCartOpen(false)} onQuantity={updateQuantity} onCheckout={() => { if (operation.accepting_orders) { setCartOpen(false); setView('checkout') } }} />}
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
