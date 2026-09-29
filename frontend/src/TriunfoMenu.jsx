import { useEffect, useState } from 'react'
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleCheck,
  Clock3, LayoutGrid, MapPin, Menu, MessageCircle,
  MousePointer2, Palette, Plus, QrCode, ReceiptText, ShoppingBag, Smartphone,
  Sparkles, Store, Utensils, X,
} from 'lucide-react'
import './TriunfoMenu.css'

const salesUrl = `https://wa.me/5585989907530?text=${encodeURIComponent('Olá! Tenho interesse no plano Basic da Triunfo Menu de R$ 149,90/mês. Gostaria de saber como contratar para o meu negócio.')}`
const previewTabs = [
  { id: 'orders', label: 'Pedidos', icon: ReceiptText },
  { id: 'menu', label: 'Cardápio', icon: Utensils },
  { id: 'design', label: 'Sua marca', icon: Palette },
]
const included = [
  'Cardápio digital com a sua marca',
  'Produtos, tamanhos e adicionais',
  'Painel de gestão de pedidos',
  'Personalização visual sem código',
  'Entrega por bairros e retirada',
  'Pix manual e pagamento na entrega',
  'Acesso para a sua equipe',
]
const features = [
  { icon: Smartphone, title: 'Seu cardápio, em qualquer tela.', text: 'Um link para o cliente explorar seus produtos, escolher adicionais e montar o pedido pelo celular.', className: 'tm-feature-wide' },
  { icon: ReceiptText, title: 'Mais organização. Menos confusão.', text: 'Receba os pedidos no painel e acompanhe cada etapa, do preparo à finalização.' },
  { icon: Palette, title: 'Com a cara do seu negócio.', text: 'Personalize cores, textos e a apresentação da sua loja. Tudo sem mexer em código.' },
  { icon: MapPin, title: 'Sua entrega, suas regras.', text: 'Defina as cidades e os bairros atendidos, configure as taxas e ofereça retirada no local.' },
]
const questions = [
  { question: 'O que está incluído no plano Basic?', answer: 'Por R$ 149,90 por mês, o Basic reúne cardápio digital, produtos com variações e adicionais, gestão de pedidos, personalização da loja, configuração de entrega e retirada, acesso para a equipe e opções de pagamento com Pix manual ou na entrega.' },
  { question: 'Preciso saber programar para personalizar?', answer: 'Não. Você pode gerenciar o cardápio e ajustar cores, textos e a apresentação da loja pelo painel administrativo, sem editar código.' },
  { question: 'Meu cliente precisa baixar um aplicativo?', answer: 'Não. O cardápio abre diretamente no navegador do celular ou do computador. Basta compartilhar o link da sua loja.' },
  { question: 'Posso definir os bairros e as taxas de entrega?', answer: 'Sim. Você configura as regiões atendidas e suas taxas. O valor de entrega é calculado no checkout de acordo com o endereço selecionado pelo cliente. Também é possível oferecer retirada no local.' },
  { question: 'Como funcionam os pagamentos?', answer: 'O Basic oferece Pix com conferência manual pela loja e pagamento na entrega. A confirmação automática de pagamentos não faz parte deste plano.' },
  { question: 'Como faço para contratar?', answer: 'Clique em “Quero o Basic” para conversar com a Triunfo Menu pelo WhatsApp. A equipe orienta sobre a contratação e a configuração inicial do seu negócio.' },
]

function Brand({ inverse = false }) {
  return <a className={`tm-brand${inverse ? ' tm-brand-inverse' : ''}`} href="#inicio" aria-label="Triunfo Menu — início">
    <img src="/triunfo-mark.svg" alt="" width="42" height="42" />
    <span>triunfo<span className="tm-brand-light">menu</span><span className="tm-brand-dot">.</span></span>
  </a>
}

function SalesLink({ children = 'Quero o Basic', className = '', ...props }) {
  return <a href={salesUrl} target="_blank" rel="noopener noreferrer" className={`tm-button ${className}`} {...props}>
    {children}<ArrowUpRight size={18} aria-hidden="true" />
  </a>
}

function BurgerArt() {
  return <svg viewBox="0 0 180 160" fill="none" aria-hidden="true" className="tm-burger-art">
    <ellipse cx="90" cy="138" rx="59" ry="8" fill="#9B6A37" opacity=".12" />
    <path d="M36 114h108v8c0 12-23 16-54 16s-54-4-54-16v-8Z" fill="#DC9143" />
    <path d="M34 100c0-8 112-8 112 0v11c0 13-112 13-112 0v-11Z" fill="#543B2A" />
    <path d="m32 96 18-6 20 6 20-6 20 6 21-6 17 6-13 7-17-3-21 8-21-9-20 4-24-7Z" fill="#EABF51" />
    <path d="M34 85h112v9H34z" fill="#C86145" />
    <path d="m29 79 15-6 15 6 16-6 15 6 16-6 15 6 15-6 15 6-8 10-15-4-14 5-18-5-15 5-15-5-17 4-20-10Z" fill="#4D7A3B" />
    <path d="M34 68c0-29 24-43 56-43s56 14 56 43c0 5-25 9-56 9s-56-4-56-9Z" fill="#EBA653" />
    <path d="m65 44 4 2m20-9 4 2m20 4 4 2M51 57l4 2m29-7 4 2m36 4 4 2m-27 4 4 2" stroke="#FFF0C8" strokeWidth="3" strokeLinecap="round" />
  </svg>
}

function ProductPreview({ color = 'green' }) {
  return <div className={`tm-mini-store tm-mini-store-${color}`}>
    <div className="tm-mini-store-heading"><span className="tm-mini-store-logo"><Utensils size={16} /></span><div><strong>Casa do Sabor</strong><span>Feito com carinho, pra você.</span></div><span className="tm-open-dot" /></div>
    <div className="tm-mini-store-banner"><div><span>SEU NOVO FAVORITO</span><strong>Sabor de<br />quero mais.</strong><small>Conheça nossos clássicos</small></div><BurgerArt /></div>
    <div className="tm-mini-categories"><span className="is-active">Destaques</span><span>Burgers</span><span>Bebidas</span></div>
    <div className="tm-mini-product"><div><strong>Burger da casa</strong><span>Pão artesanal, carne e queijo.</span><b>R$ 28,90</b></div><span className="tm-mini-add"><Plus size={16} /></span></div>
    <div className="tm-mini-product"><div><strong>Combo especial</strong><span>Burger + batata + bebida.</span><b>R$ 39,90</b></div><span className="tm-mini-add"><Plus size={16} /></span></div>
  </div>
}

function DashboardPreview() {
  const [activeTab, setActiveTab] = useState('orders')
  const [color, setColor] = useState('green')
  const palettes = [{ id: 'green', label: 'Verde' }, { id: 'terracotta', label: 'Terracota' }, { id: 'purple', label: 'Roxo' }]
  return <div className="tm-product-scene" id="demonstracao">
    <div className="tm-scene-label"><span /> UM POUCO DO SEU PRÓXIMO CAPÍTULO</div>
    <div className="tm-dashboard">
      <div className="tm-dashboard-top"><div className="tm-window-dots"><i /><i /><i /></div><span>Seu negócio. No controle.</span><span className="tm-avatar">CS</span></div>
      <div className="tm-dashboard-body">
        <div className="tm-dashboard-sidebar" aria-hidden="true"><img src="/triunfo-mark.svg" alt="" /><span className="is-active"><LayoutGrid size={18} /></span><ReceiptText size={18} /><Utensils size={18} /><Palette size={18} /><span className="tm-sidebar-bottom"><Store size={18} /></span></div>
        <div className="tm-dashboard-main">
          <div className="tm-dashboard-greeting"><div><span>PAINEL DA SUA LOJA</span><h3>Olá, Casa do Sabor <span>✦</span></h3></div><span className="tm-store-open"><i /> Loja aberta</span></div>
          <div className="tm-preview-tabs" role="tablist" aria-label="Explore a demonstração">
            {previewTabs.map(({ id, label, icon: Icon }) => <button key={id} id={`tm-tab-${id}`} role="tab" aria-selected={activeTab === id} aria-controls={`tm-panel-${id}`} tabIndex={activeTab === id ? 0 : -1} className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)} onKeyDown={(event) => {
              const current = previewTabs.findIndex((tab) => tab.id === id)
              const next = event.key === 'ArrowRight' ? (current + 1) % previewTabs.length : event.key === 'ArrowLeft' ? (current + previewTabs.length - 1) % previewTabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? previewTabs.length - 1 : null
              if (next !== null) { event.preventDefault(); setActiveTab(previewTabs[next].id); document.getElementById(`tm-tab-${previewTabs[next].id}`)?.focus() }
            }}><Icon size={14} aria-hidden="true" />{label}</button>)}
          </div>
          <div className="tm-preview-panel" id={`tm-panel-${activeTab}`} role="tabpanel" aria-labelledby={`tm-tab-${activeTab}`} tabIndex={0}>
            {activeTab === 'orders' && <>
              <div className="tm-stats"><div><span>Pedidos hoje</span><strong>24<span>↗</span></strong></div><div><span>Em preparo</span><strong>08<span className="tm-stats-clock"><Clock3 size={15} /></span></strong></div><div><span>Concluídos</span><strong>16<span><Check size={16} /></span></strong></div></div>
              <div className="tm-orders-title"><strong>Pedidos chegando</strong><span>Hoje <ChevronDown size={10} /></span></div>
              <div className="tm-order-row"><span className="tm-order-icon"><ShoppingBag size={17} /></span><div><strong>Pedido #024</strong><span>2 itens · Entrega</span></div><span className="tm-status tm-status-new">Novo pedido</span><b>R$ 57,80</b></div>
              <div className="tm-order-row"><span className="tm-order-icon"><ShoppingBag size={17} /></span><div><strong>Pedido #023</strong><span>3 itens · Retirada</span></div><span className="tm-status tm-status-making">Em preparo</span><b>R$ 68,90</b></div>
              <div className="tm-order-row"><span className="tm-order-icon"><ShoppingBag size={17} /></span><div><strong>Pedido #022</strong><span>1 item · Entrega</span></div><span className="tm-status tm-status-done">Concluído</span><b>R$ 28,90</b></div>
              <div className="tm-preview-tip"><CircleCheck size={14} /><span>Cada pedido no lugar certo.</span></div>
            </>}
            {activeTab === 'menu' && <div className="tm-catalog-demo"><ProductPreview /><div className="tm-demo-caption"><QrCode size={19} /><span>Seu cliente escolhe.<br /><strong>Seu painel recebe.</strong></span></div></div>}
            {activeTab === 'design' && <div className="tm-design-demo"><div className="tm-design-controls"><span className="tm-demo-eyebrow">DO SEU JEITO</span><h4>Uma loja.<br />A sua identidade.</h4><p>Experimente uma cor:</p><div className="tm-color-options">{palettes.map((palette) => <button key={palette.id} className={`tm-color-${palette.id}`} aria-label={`Usar cor ${palette.label.toLowerCase()}`} aria-pressed={color === palette.id} onClick={() => setColor(palette.id)}>{color === palette.id && <Check size={16} />}</button>)}</div><small>Prévia ilustrativa da personalização.</small></div><ProductPreview color={color} /></div>}
          </div>
          <div className="tm-preview-disclaimer">Demonstração ilustrativa · dados fictícios</div>
        </div>
      </div>
    </div>
    <div className="tm-floating-order"><span><CircleCheck size={23} /></span><div><strong>Olha o pedido chegando!</strong><small>Do cardápio direto para o seu painel.</small></div><i>agora</i></div>
    <div className="tm-scene-footer"><MousePointer2 size={14} /> Explore as abas acima e veja as possibilidades.</div>
  </div>
}

export default function TriunfoMenu() {
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    document.title = 'Triunfo Menu — Seu negócio merece esse próximo passo'
    const description = document.querySelector('meta[name="description"]')
    const originalDescription = description?.content
    if (description) description.content = 'Cardápio digital, gestão de pedidos e personalização sem código. Conheça a Triunfo Menu e o plano Basic por R$ 149,90/mês.'
    const favicon = document.querySelector('link[rel="icon"]')
    const originalFavicon = favicon?.getAttribute('href')
    if (favicon) favicon.setAttribute('href', '/triunfo-mark.svg')
    return () => { if (description) description.content = originalDescription; if (favicon && originalFavicon) favicon.setAttribute('href', originalFavicon) }
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event) => { if (event.key === 'Escape') { setMenuOpen(false); document.getElementById('tm-menu-toggle')?.focus() } }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return <div className="tm-site" id="inicio">
    <a className="tm-skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header className="tm-header">
      <div className="tm-container tm-header-inner">
        <Brand />
        <button id="tm-menu-toggle" className="tm-menu-toggle" aria-expanded={menuOpen} aria-controls="tm-navigation" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button>
        <nav id="tm-navigation" className={`tm-navigation${menuOpen ? ' is-open' : ''}`} aria-label="Navegação principal" onClick={(event) => { if (event.target.closest('a')) setMenuOpen(false) }}>
          <a href="#recursos">A plataforma</a><a href="#como-funciona">Como funciona</a><a href="#planos">Plano Basic</a><a href="#duvidas">Dúvidas</a>
          <SalesLink className="tm-button-small tm-button-dark">Vamos começar</SalesLink>
        </nav>
      </div>
    </header>

    <main id="conteudo">
      <section className="tm-hero tm-container" aria-labelledby="tm-hero-heading">
        <div className="tm-hero-copy">
          <span className="tm-eyebrow tm-hero-badge"><span /> O SEU NEGÓCIO TEM UM PRÓXIMO NÍVEL</span>
          <h1 id="tm-hero-heading">Muito mais que<br />um cardápio.<br /><span>O seu próximo<br className="tm-desktop-break" /> triunfo.</span></h1>
          <p>Sua marca em destaque. Seus pedidos organizados.<br className="tm-desktop-break" /> Tudo em uma plataforma simples, feita para quem<br className="tm-desktop-break" /> coloca sabor no mundo.</p>
          <div className="tm-hero-actions"><a className="tm-button tm-button-green" href="#planos">Conhecer o Basic <ArrowRight size={18} /></a><a className="tm-text-link" href="#demonstracao">Explore a plataforma <ArrowUpRight size={17} /></a></div>
          <div className="tm-hero-note"><CircleCheck size={16} /><span>Seu próximo passo por <strong>R$ 149,90/mês.</strong></span></div>
        </div>
        <DashboardPreview />
        <div className="tm-hero-bottom"><span>MENOS COMPLICAÇÃO. MAIS TEMPO PARA O QUE IMPORTA.</span><a href="#recursos" aria-label="Conhecer os recursos"><ArrowDown size={18} /></a></div>
      </section>

      <div className="tm-audience"><div className="tm-container"><span>Feito para o seu jeito de servir.</span><div><Utensils size={18} />Restaurantes</div><div><Store size={18} />Lanchonetes</div><div><ShoppingBag size={18} />Delivery</div><div><QrCode size={18} />Seu negócio</div></div></div>

      <section id="recursos" className="tm-section tm-container" aria-labelledby="tm-features-heading">
        <div className="tm-section-heading"><div><span className="tm-eyebrow">TUDO CONECTADO. TUDO MAIS SIMPLES.</span><h2 id="tm-features-heading">Você cuida do sabor.<br /><span>A gente facilita o resto.</span></h2></div><p>Da primeira escolha ao último pedido do dia.<br />As ferramentas certas para a sua operação<br className="tm-desktop-break" /> funcionar melhor.</p></div>
        <div className="tm-feature-grid">{features.map(({ icon: Icon, title, text, className = '' }, index) => <article className={`tm-feature ${className}`} key={title}>
          <span className="tm-feature-icon"><Icon size={24} strokeWidth={1.7} /></span><h3>{title}</h3><p>{text}</p>
          {index === 0 && <div className="tm-feature-link"><span><Check size={14} /> Celular</span><span><Check size={14} /> Tablet</span><span><Check size={14} /> Computador</span></div>}
          {index === 1 && <div className="tm-feature-flow"><span>Recebido</span><ArrowRight size={13} /><span>Em preparo</span><ArrowRight size={13} /><span>Pronto</span></div>}
          {index === 2 && <div className="tm-feature-swatches" aria-hidden="true"><i /><i /><i /><span>A sua identidade em cada detalhe.</span></div>}
          {index === 3 && <div className="tm-feature-location"><MapPin size={14} /> Do seu bairro para a sua cidade.</div>}
        </article>)}</div>
      </section>

      <section id="como-funciona" className="tm-how-section" aria-labelledby="tm-how-heading"><div className="tm-container">
        <div className="tm-section-heading"><div><span className="tm-eyebrow">DO SEU JEITO, SEM COMPLICAR</span><h2 id="tm-how-heading">Do seu balcão<br /><span>para a tela do cliente.</span></h2></div><a className="tm-text-link" href={salesUrl} target="_blank" rel="noopener noreferrer">Conte com a gente para começar <ArrowUpRight size={17} /></a></div>
        <div className="tm-steps"><article><span className="tm-step-number">01</span><h3>Monte o seu cardápio</h3><p>Cadastre os produtos, preços, fotos e adicionais que fazem o seu negócio ser único.</p></article><article><span className="tm-step-number">02</span><h3>Deixe com a sua cara</h3><p>Escolha cores, ajuste a apresentação e configure as opções de entrega e retirada.</p></article><article><span className="tm-step-number">03</span><h3>Compartilhe e receba pedidos</h3><p>Divulgue o link da sua loja e acompanhe os pedidos chegando no seu painel.</p></article></div>
      </div></section>

      <section id="planos" className="tm-section tm-container tm-pricing-section" aria-labelledby="tm-pricing-heading">
        <div className="tm-pricing-intro"><span className="tm-eyebrow">SIMPLES ATÉ NA HORA DE ESCOLHER</span><h2 id="tm-pricing-heading">O essencial para <br />começar.<br /><span>O potencial para <br />ir além.</span></h2><p>Um plano para colocar o seu negócio no digital e organizar a rotina, sem complicação.</p><div className="tm-pricing-note"><span><MessageCircle size={22} /></span><div><strong>Ficou com alguma dúvida?</strong><a href={salesUrl} target="_blank" rel="noopener noreferrer">Vamos conversar no WhatsApp <ArrowUpRight size={14} /></a></div></div></div>
        <article className="tm-price-card"><div className="tm-plan-heading"><span><Sparkles size={18} /> PLANO BASIC</span><span className="tm-plan-tag">Seu próximo passo</span></div><h3>Pequeno no nome.<br />Grande nas possibilidades.</h3><div className="tm-price"><span>R$</span><strong>149<span>,90</span></strong><span>/mês</span></div><p className="tm-price-description">Uma plataforma. O controle nas suas mãos.</p><div className="tm-price-divider" /><ul>{included.map((feature) => <li key={feature}><Check size={17} />{feature}</li>)}</ul><SalesLink className="tm-button-lime">Quero o Basic</SalesLink><span className="tm-price-footnote"><MessageCircle size={13} /> Contratação pelo WhatsApp · fale com a nossa equipe</span></article>
      </section>

      <section id="duvidas" className="tm-faq-section" aria-labelledby="tm-faq-heading"><div className="tm-container tm-faq-layout"><div><span className="tm-eyebrow">ANTES DO PRIMEIRO PEDIDO</span><h2 id="tm-faq-heading">Uma boa escolha <br />começa sem<br /><span>dúvidas.</span></h2><p>Se precisar de uma mão,<br />é só chamar a gente.</p><a className="tm-text-link" href={salesUrl} target="_blank" rel="noopener noreferrer">Falar com a Triunfo <ArrowUpRight size={17} /></a></div><div className="tm-faq-list">{questions.map(({ question, answer }) => <details key={question} name="tm-faq"><summary>{question}<Plus size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="tm-final-section tm-container"><div className="tm-final-cta"><div><span className="tm-eyebrow">VAMOS ESCREVER O PRÓXIMO CAPÍTULO?</span><h2>Seu negócio merece<br /><span>esse triunfo.</span></h2></div><div><SalesLink className="tm-button-dark">Começar com o Basic</SalesLink><span>R$ 149,90/mês. Simples assim.</span></div><div className="tm-final-decoration" aria-hidden="true">✳</div></div></section>
    </main>

    <footer className="tm-footer"><div className="tm-container"><div className="tm-footer-main"><Brand /><p>Tecnologia que serve o seu negócio.</p><a href={salesUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> (85) 98990-7530 <ArrowUpRight size={14} /></a></div><div className="tm-footer-bottom"><span>© {new Date().getFullYear()} Triunfo Menu. Todos os direitos reservados.</span><span>Feito para quem coloca sabor no mundo.</span><a href="#inicio">Voltar ao topo ↑</a></div></div></footer>
  </div>
}
