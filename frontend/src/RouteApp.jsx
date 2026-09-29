import { lazy, Suspense } from 'react'

const App = lazy(() => import('./App.jsx'))
const TriunfoMenu = lazy(() => import('./TriunfoMenu.jsx'))

export default function RouteApp() {
  const isMarketingPage = /^\/triunfo-menu\/?$/.test(window.location.pathname)

  return <Suspense fallback={<div role="status" style={{ padding: '2rem', textAlign: 'center' }}>Carregando…</div>}>
    {isMarketingPage ? <TriunfoMenu /> : <App />}
  </Suspense>
}
